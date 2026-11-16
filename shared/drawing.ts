// Çizim verisinin tipleri ve geçmişe uygulama kuralı (istemci ve sunucu ortak kullanır).

export const CANVAS_W = 800;
export const CANVAS_H = 600;

export type ShapeKind = 'line' | 'rect' | 'ellipse' | 'triangle';
export const SHAPE_KINDS: readonly ShapeKind[] = ['line', 'rect', 'ellipse', 'triangle'];

/** Şekil: (x1,y1) başlangıç, (x2,y2) bitiş köşesi. */
export interface Shape {
  shape: ShapeKind;
  color: string;
  size: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export type DrawOp =
  | { t: 'start'; color: string; size: number; x: number; y: number }
  | { t: 'move'; pts: number[] }
  | { t: 'fill'; color: string; x: number; y: number }
  | ({ t: 'shape' } & Shape)
  | { t: 'undo' }
  | { t: 'clear' };

export type DrawItem =
  | { k: 'stroke'; color: string; size: number; pts: number[] }
  | { k: 'fill'; color: string; x: number; y: number }
  | ({ k: 'shape' } & Shape);

/** Bir çizim işlemini geçmişe uygular (yerinde değiştirir). */
export function applyOp(items: DrawItem[], op: DrawOp): void {
  switch (op.t) {
    case 'start':
      items.push({ k: 'stroke', color: op.color, size: op.size, pts: [op.x, op.y] });
      break;
    case 'move': {
      const last = items[items.length - 1];
      if (last && last.k === 'stroke') last.pts.push(...op.pts);
      break;
    }
    case 'fill':
      items.push({ k: 'fill', color: op.color, x: op.x, y: op.y });
      break;
    case 'shape': {
      const { t: _t, ...shape } = op;
      items.push({ k: 'shape', ...shape });
      break;
    }
    case 'undo':
      items.pop();
      break;
    case 'clear':
      items.length = 0;
      break;
  }
}
