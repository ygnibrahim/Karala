import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { applyOp, CANVAS_H, CANVAS_W, type DrawItem, type DrawOp, type Shape, type ShapeKind } from '../../../shared/protocol';
import { BG, drawShape, drawStroke, floodFill, redraw } from '../draw';
import { socket } from '../socket';

const COLORS = [
  '#000000', '#5c5f66', '#ffffff', '#8d5a2b',
  '#c92a2a', '#ff6b6b', '#e8590c', '#ffa94d',
  '#fcc419', '#2b8a3e', '#69db7c', '#1864ab',
  '#4dabf7', '#5f3dc4', '#b197fc', '#d6336c',
];
const SIZES = [4, 10, 20, 36];
/** Paletteki şekiller. 'kind' sunucuya giden şekil türü, 'equal' en-boy eşit tutulsun mu (kare/daire). */
const SHAPE_TOOLS = [
  { id: 'line', kind: 'line', equal: false, title: 'Düz çizgi', icon: <path d="M5 19 L19 5" /> },
  { id: 'square', kind: 'rect', equal: true, title: 'Kare', icon: <rect x="5" y="5" width="14" height="14" rx="1" /> },
  { id: 'rect', kind: 'rect', equal: false, title: 'Dikdörtgen', icon: <rect x="3" y="7.5" width="18" height="9" rx="1" /> },
  { id: 'circle', kind: 'ellipse', equal: true, title: 'Daire', icon: <circle cx="12" cy="12" r="7.5" /> },
  { id: 'ellipse', kind: 'ellipse', equal: false, title: 'Elips', icon: <ellipse cx="12" cy="12" rx="9.5" ry="5.5" /> },
  { id: 'triangle', kind: 'triangle', equal: false, title: 'Üçgen', icon: <path d="M12 4.5 L20 19 L4 19 Z" /> },
] as const satisfies readonly { id: string; kind: ShapeKind; equal: boolean; title: string; icon: ReactNode }[];

type ShapeTool = (typeof SHAPE_TOOLS)[number];
type Tool = 'pen' | 'eraser' | 'fill' | ShapeTool['id'];
const findShapeTool = (t: Tool): ShapeTool | undefined => SHAPE_TOOLS.find((s) => s.id === t);

export default function Board({ canDraw, overlay }: { canDraw: boolean; overlay?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const itemsRef = useRef<DrawItem[]>([]);
  const pendingRef = useRef<number[]>([]);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<[number, number]>([0, 0]);
  const previewRef = useRef<HTMLCanvasElement>(null);
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
        if (!s || s.k !== 'stroke') return;
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

  const send = useCallback((op: DrawOp) => {
    flush();
    render(op);
    socket.emit('draw:op', op);
  }, [flush, render]);

  // Tuval kurulumu ve sunucudan gelen çizimler
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d', { willReadFrequently: true })!;
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

  // Hareket noktalarını ~25 kez/sn paketleyip gönder
  useEffect(() => {
    if (!canDraw) {
      drawingRef.current = false;
      clearPreview();
      flush();
      return;
    }
    const id = setInterval(flush, 40);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [canDraw, flush]);

  const toCanvas = (e: { clientX: number; clientY: number }): [number, number] => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    return [Math.round(Math.min(CANVAS_W - 1, Math.max(0, x))), Math.round(Math.min(CANVAS_H - 1, Math.max(0, y)))];
  };

  function clearPreview() {
    shapeRef.current = null;
    const p = previewRef.current?.getContext('2d');
    p?.clearRect(0, 0, CANVAS_W, CANVAS_H);
  }

  /** Şekil sürüklenirken önizleme katmanına çiz; diğer oyuncular sadece bitmiş şekli görür. */
  const updateShape = (e: { clientX: number; clientY: number }) => {
    const s = shapeRef.current;
    const p = previewRef.current?.getContext('2d');
    if (!s || !p) return;
    let [x2, y2] = toCanvas(e);
    if (equalRef.current) {
      // Kare / daire: en ve boy eşit
      const d = Math.max(Math.abs(x2 - s.x1), Math.abs(y2 - s.y1));
      x2 = s.x1 + Math.sign(x2 - s.x1 || 1) * d;
      y2 = s.y1 + Math.sign(y2 - s.y1 || 1) * d;
    }
    s.x2 = x2;
    s.y2 = y2;
    p.clearRect(0, 0, CANVAS_W, CANVAS_H);
    drawShape(p, s);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (shapeRef.current) return updateShape(e);
    if (!drawingRef.current) return;
    const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent];
    const pts: number[] = [];
    for (const ev of events) {
      const [x, y] = toCanvas(ev);
      const [lx, ly] = lastPtRef.current;
      if (Math.abs(x - lx) + Math.abs(y - ly) < 2) continue;
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

  return (
    <div className="board">
      <div className="board-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          className={canDraw ? 'can-draw tool-' + tool : ''}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onContextMenu={(e) => e.preventDefault()}
        />
        <canvas ref={previewRef} width={CANVAS_W} height={CANVAS_H} className="board-preview" aria-hidden />
        {overlay && <div className="board-overlay">{overlay}</div>}
      </div>

      {canDraw && (
        <div className="toolbar">
          <div className="colors">
            {COLORS.map((c) => (
              <button
                key={c}
                className={'color' + (c === color && tool !== 'eraser' ? ' active' : '')}
                style={{ background: c }}
                aria-label={`Renk ${c}`}
                onClick={() => {
                  setColor(c);
                  if (tool === 'eraser') setTool('pen');
                }}
              />
            ))}
          </div>
          <div className="shapes" role="group" aria-label="Şekiller">
            {SHAPE_TOOLS.map((t) => (
              <button
                key={t.id}
                className={'shape' + (tool === t.id ? ' active' : '')}
                onClick={() => setTool(t.id)}
                title={t.title}
                aria-label={t.title}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke={color === '#ffffff' ? '#adb5bd' : color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  {t.icon}
                </svg>
              </button>
            ))}
          </div>
          <div className="tool-group">
            {SIZES.map((s) => (
              <button key={s} className={'tool size' + (s === size ? ' active' : '')} onClick={() => setSize(s)} aria-label={`Kalınlık ${s}`}>
                <span style={{ width: Math.max(4, s / 1.6), height: Math.max(4, s / 1.6), background: tool === 'eraser' ? '#adb5bd' : color }} />
              </button>
            ))}
          </div>
          <div className="tool-group">
            <button className={'tool' + (tool === 'pen' ? ' active' : '')} onClick={() => setTool('pen')} title="Kalem">✏️</button>
            <button className={'tool' + (tool === 'eraser' ? ' active' : '')} onClick={() => setTool('eraser')} title="Silgi">🧽</button>
            <button className={'tool' + (tool === 'fill' ? ' active' : '')} onClick={() => setTool('fill')} title="Boya kovası">🪣</button>
          </div>
          <div className="tool-group">
            <button className="tool" onClick={() => send({ t: 'undo' })} title="Geri al">↶</button>
            <button
              className="tool"
              title="Hepsini sil"
              onClick={() => {
                if (itemsRef.current.length && confirm('Tüm çizim silinsin mi?')) send({ t: 'clear' });
              }}
            >
              🗑️
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

