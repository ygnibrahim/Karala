// İstemciden gelen çizim işlemlerini doğrular ve güvenli bir kopyasını üretir.
// Bilinmeyen alanlar atılır, sayılar tuval sınırlarına kırpılır, renk sadece #rrggbb olabilir.
import { CANVAS_H, CANVAS_W, type DrawOp, SHAPE_KINDS, type ShapeKind } from '@shared';
import { SERVER_LIMITS } from '../config';

const toInt = (v: unknown, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(0, Math.round(v))) : null;

const toColor = (v: unknown): string | null => (typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null);

const toSize = (v: unknown): number | null => {
  const size = toInt(v, SERVER_LIMITS.maxBrushSize);
  return size && size > 0 ? size : null;
};

const isShapeKind = (v: unknown): v is ShapeKind => typeof v === 'string' && SHAPE_KINDS.includes(v as ShapeKind);

export function sanitizeDrawOp(input: unknown): DrawOp | null {
  if (!input || typeof input !== 'object') return null;
  const op = input as Record<string, unknown>;

  switch (op.t) {
    case 'start': {
      const x = toInt(op.x, CANVAS_W);
      const y = toInt(op.y, CANVAS_H);
      const color = toColor(op.color);
      const size = toSize(op.size);
      return x !== null && y !== null && color && size ? { t: 'start', color, size, x, y } : null;
    }
    case 'move': {
      const raw = op.pts;
      if (!Array.isArray(raw) || raw.length === 0 || raw.length > SERVER_LIMITS.maxPointsPerMove || raw.length % 2) return null;
      const pts: number[] = [];
      for (let i = 0; i < raw.length; i += 2) {
        const x = toInt(raw[i], CANVAS_W);
        const y = toInt(raw[i + 1], CANVAS_H);
        if (x === null || y === null) return null;
        pts.push(x, y);
      }
      return { t: 'move', pts };
    }
    case 'fill': {
      const x = toInt(op.x, CANVAS_W - 1);
      const y = toInt(op.y, CANVAS_H - 1);
      const color = toColor(op.color);
      return x !== null && y !== null && color ? { t: 'fill', color, x, y } : null;
    }
    case 'shape': {
      const x1 = toInt(op.x1, CANVAS_W);
      const y1 = toInt(op.y1, CANVAS_H);
      const x2 = toInt(op.x2, CANVAS_W);
      const y2 = toInt(op.y2, CANVAS_H);
      const color = toColor(op.color);
      const size = toSize(op.size);
      if (x1 === null || y1 === null || x2 === null || y2 === null || !color || !size || !isShapeKind(op.shape)) {
        return null;
      }
      return { t: 'shape', shape: op.shape, color, size, x1, y1, x2, y2 };
    }
    case 'undo':
      return { t: 'undo' };
    case 'clear':
      return { t: 'clear' };
    default:
      return null;
  }
}
