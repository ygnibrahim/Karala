import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { applyOp, CANVAS_H, CANVAS_W, type DrawItem, type DrawOp } from '../../../shared/protocol';
import { BG, drawStroke, floodFill, redraw } from '../draw';
import { socket } from '../socket';

const COLORS = [
  '#000000', '#5c5f66', '#ffffff', '#8d5a2b',
  '#c92a2a', '#ff6b6b', '#e8590c', '#ffa94d',
  '#fcc419', '#2b8a3e', '#69db7c', '#1864ab',
  '#4dabf7', '#5f3dc4', '#b197fc', '#d6336c',
];
const SIZES = [4, 10, 20, 36];
type Tool = 'pen' | 'eraser' | 'fill';

export default function Board({ canDraw, overlay }: { canDraw: boolean; overlay?: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const itemsRef = useRef<DrawItem[]>([]);
  const pendingRef = useRef<number[]>([]);
  const drawingRef = useRef(false);
  const lastPtRef = useRef<[number, number]>([0, 0]);

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

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    const [x, y] = toCanvas(e);
    if (tool === 'fill') {
      send({ t: 'fill', color, x, y });
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPtRef.current = [x, y];
    send({ t: 'start', color: tool === 'eraser' ? BG : color, size, x, y });
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
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

