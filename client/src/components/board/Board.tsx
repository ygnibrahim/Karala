// Çizim tahtası: tuval, şekil önizlemesi ve (çizen için) araç çubuğu.
// Çizim işlemleri hem yerelde hemen çizilir hem de sunucuya gönderilir; diğerlerinin işlemleri socket'ten gelir.
import { applyOp, CANVAS_H, CANVAS_W, type DrawItem, type DrawOp, type Shape } from '@shared';
import { type ReactNode, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { floodFill } from '../../canvas/floodFill';
import { BG, drawShape, drawStroke, redraw } from '../../canvas/render';
import { socket } from '../../lib/socket';
import Toolbar from './Toolbar';
import { findShapeTool, type Tool } from './tools';

/** Hareket noktaları bu aralıkla paketlenip gönderilir (~25 paket/sn). */
const FLUSH_MS = 40;
/** Bundan kısa hareketler gönderilmez (gereksiz veri). */
const MIN_POINT_DISTANCE = 2;

type Point = [number, number];

export default function Board({ canDraw, overlay }: { canDraw: boolean; overlay?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const itemsRef = useRef<DrawItem[]>([]);
  const pendingRef = useRef<number[]>([]);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<Point>([0, 0]);
  const shapeRef = useRef<Shape | null>(null);
  const equalRef = useRef(false);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(10);

  /** Bir işlemi yerel geçmişe uygulayıp tuvale çizer. */
  const render = useCallback((op: DrawOp) => {
    const ctx = ctxRef.current;
    const items = itemsRef.current;
    if (!ctx) return;
    switch (op.t) {
      case 'start': {
        applyOp(items, op);
        const s = items[items.length - 1];
        if (s.k === 'stroke') drawStroke(ctx, s, 0);
        break;
      }
      case 'move': {
        const s = items[items.length - 1];
        if (s?.k !== 'stroke') return;
        const before = s.pts.length / 2;
        applyOp(items, op);
        drawStroke(ctx, s, before);
        break;
      }
      case 'fill':
        applyOp(items, op);
        floodFill(ctx, op.x, op.y, op.color);
        break;
      case 'shape':
        applyOp(items, op);
        drawShape(ctx, op);
        break;
      default:
        applyOp(items, op);
        redraw(ctx, items);
    }
  }, []);

  const flush = useCallback(() => {
    if (pendingRef.current.length === 0) return;
    socket.emit('draw:op', { t: 'move', pts: pendingRef.current });
    pendingRef.current = [];
  }, []);

  const send = useCallback(
    (op: DrawOp) => {
      flush();
      render(op);
      socket.emit('draw:op', op);
    },
    [flush, render],
  );

  const clearPreview = useCallback(() => {
    shapeRef.current = null;
    previewRef.current?.getContext('2d')?.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }, []);

  // Tuval kurulumu ve sunucudan gelen çizimler
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctxRef.current = ctx;
    redraw(ctx, itemsRef.current);

    const onOp = (op: DrawOp) => render(op);
    const onHistory = (items: DrawItem[]) => {
      itemsRef.current = items.map((it) => (it.k === 'stroke' ? { ...it, pts: [...it.pts] } : { ...it }));
      redraw(ctx, itemsRef.current);
    };
    socket.on('draw:op', onOp);
    socket.on('draw:history', onHistory);
    return () => {
      socket.off('draw:op', onOp);
      socket.off('draw:history', onHistory);
    };
  }, [render]);

  // Çizim hakkı varken hareket noktalarını düzenli aralıkla gönder
  useEffect(() => {
    if (!canDraw) {
      drawingRef.current = false;
      clearPreview();
      flush();
      return;
    }
    const id = setInterval(flush, FLUSH_MS);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [canDraw, flush, clearPreview]);

  const toCanvas = (e: { clientX: number; clientY: number }): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return [0, 0];
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return [Math.round(Math.min(CANVAS_W - 1, Math.max(0, x))), Math.round(Math.min(CANVAS_H - 1, Math.max(0, y)))];
  };

  /** Şekil sürüklenirken önizleme katmanına çiz; diğer oyuncular sadece bitmiş şekli görür. */
  const updateShape = (e: { clientX: number; clientY: number }) => {
    const s = shapeRef.current;
    const preview = previewRef.current?.getContext('2d');
    if (!s || !preview) return;
    let [x2, y2] = toCanvas(e);
    if (equalRef.current) {
      const d = Math.max(Math.abs(x2 - s.x1), Math.abs(y2 - s.y1));
      x2 = s.x1 + Math.sign(x2 - s.x1 || 1) * d;
      y2 = s.y1 + Math.sign(y2 - s.y1 || 1) * d;
    }
    s.x2 = x2;
    s.y2 = y2;
    preview.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawShape(preview, s);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const [x, y] = toCanvas(e);
    if (tool === 'fill') {
      send({ t: 'fill', color, x, y });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);

    const shapeTool = findShapeTool(tool);
    if (shapeTool) {
      equalRef.current = shapeTool.equal;
      shapeRef.current = { shape: shapeTool.kind, color, size, x1: x, y1: y, x2: x, y2: y };
      updateShape(e);
      return;
    }
    drawingRef.current = true;
    lastPtRef.current = [x, y];
    send({ t: 'start', color: tool === 'eraser' ? BG : color, size, x, y });
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (shapeRef.current) return updateShape(e);
    if (!drawingRef.current) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const pts: number[] = [];
    for (const ev of events) {
      const [x, y] = toCanvas(ev);
      const [lx, ly] = lastPtRef.current;
      if (Math.abs(x - lx) + Math.abs(y - ly) < MIN_POINT_DISTANCE) continue;
      lastPtRef.current = [x, y];
      pts.push(x, y);
    }
    if (pts.length === 0) return;
    render({ t: 'move', pts });
    pendingRef.current.push(...pts);
    if (pendingRef.current.length >= 300) flush();
  };

  const onPointerUp = () => {
    const s = shapeRef.current;
    if (s) {
      clearPreview();
      // Neredeyse sıfır boyutlu şekilleri (yanlışlıkla dokunma) yok say
      if (Math.abs(s.x2 - s.x1) + Math.abs(s.y2 - s.y1) >= 4) send({ t: 'shape', ...s });
      return;
    }
    if (!drawingRef.current) return;
    drawingRef.current = false;
    flush();
  };

  const clearAll = () => {
    if (itemsRef.current.length && confirm('Tüm çizim silinsin mi?')) send({ t: 'clear' });
  };

  return (
    <div className="board">
      <div className="board-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={canDraw ? `can-draw tool-${tool}` : ''}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        <canvas ref={previewRef} width={CANVAS_W} height={CANVAS_H} className="board-preview" />
        {overlay && <div className="board-overlay">{overlay}</div>}
      </div>

      {canDraw && (
        <Toolbar
          tool={tool}
          color={color}
          size={size}
          onTool={setTool}
          onColor={setColor}
          onSize={setSize}
          onUndo={() => send({ t: 'undo' })}
          onClear={clearAll}
        />
      )}
    </div>
  );
}
