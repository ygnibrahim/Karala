import { CANVAS_H, CANVAS_W, type DrawItem, type Shape } from '../../shared/protocol';

export const BG = '#ffffff';

export function clearCanvas(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

/** Çizginin `fromPoint` indeksinden itibaren olan kısmını çizer (artımlı çizim için). */
export function drawStroke(ctx: CanvasRenderingContext2D, s: Extract<DrawItem, { k: 'stroke' }>, fromPoint = 0) {
  const n = s.pts.length / 2;
  if (n === 0) return;
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (n === 1 || fromPoint === 0) {
    ctx.beginPath();
    ctx.arc(s.pts[0], s.pts[1], s.size / 2, 0, Math.PI * 2);
    ctx.fill();
    if (n === 1) return;
  }
  const start = Math.max(0, fromPoint - 1);
  ctx.beginPath();
  ctx.moveTo(s.pts[start * 2], s.pts[start * 2 + 1]);
  for (let i = start + 1; i < n; i++) ctx.lineTo(s.pts[i * 2], s.pts[i * 2 + 1]);
  ctx.stroke();
}

/** Çizgi, dikdörtgen, elips ya da üçgen çizer (içi boş, kenar kalınlığı = size). */
export function drawShape(ctx: CanvasRenderingContext2D, s: Shape) {
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  if (s.shape === 'line') {
    ctx.moveTo(s.x1, s.y1);
    ctx.lineTo(s.x2, s.y2);
  } else if (s.shape === 'rect') {
    ctx.rect(Math.min(s.x1, s.x2), Math.min(s.y1, s.y2), Math.abs(s.x2 - s.x1), Math.abs(s.y2 - s.y1));
  } else if (s.shape === 'triangle') {
    // Tepe noktası sürüklemenin başladığı satırda, taban bittiği satırda
    ctx.moveTo((s.x1 + s.x2) / 2, s.y1);
    ctx.lineTo(s.x2, s.y2);
    ctx.lineTo(s.x1, s.y2);
    ctx.closePath();
  } else {
    const rx = Math.abs(s.x2 - s.x1) / 2, ry = Math.abs(s.y2 - s.y1) / 2;
    ctx.ellipse((s.x1 + s.x2) / 2, (s.y1 + s.y2) / 2, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, Math.PI * 2);
  }
  ctx.stroke();
}

function hexToRgba(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 255, g = (v >> 8) & 255, b = v & 255;
  // Uint32Array little-endian: ABGR
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0;
}

/** Tıklanan noktadan başlayarak benzer renkli alanı boyar (taşma toleranslı). */
export function floodFill(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
  const img = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  const data = new Uint32Array(img.data.buffer);
  const target = data[y * CANVAS_W + x];
  const fill = hexToRgba(color);
  if (target === fill) return;

  const tr = target & 255, tg = (target >> 8) & 255, tb = (target >> 16) & 255;
  const TOL = 48;
  const matches = (c: number) =>
    Math.abs((c & 255) - tr) <= TOL && Math.abs(((c >> 8) & 255) - tg) <= TOL && Math.abs(((c >> 16) & 255) - tb) <= TOL;

  const seen = new Uint8Array(CANVAS_W * CANVAS_H);
  const stack = [x, y];
  while (stack.length) {
    const cy = stack.pop()!;
    let cx = stack.pop()!;
    // Satırın soluna kadar git, sonra sağa doğru doldur (scanline).
    while (cx > 0 && !seen[cy * CANVAS_W + cx - 1] && matches(data[cy * CANVAS_W + cx - 1])) cx--;
    let up = false, down = false;
    for (; cx < CANVAS_W; cx++) {
      const i = cy * CANVAS_W + cx;
      if (seen[i] || !matches(data[i])) break;
      data[i] = fill;
      seen[i] = 1;
      if (cy > 0) {
        const ok = !seen[i - CANVAS_W] && matches(data[i - CANVAS_W]);
        if (ok && !up) stack.push(cx, cy - 1);
        up = ok;
      }
      if (cy < CANVAS_H - 1) {
        const ok = !seen[i + CANVAS_W] && matches(data[i + CANVAS_W]);
        if (ok && !down) stack.push(cx, cy + 1);
        down = ok;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function redraw(ctx: CanvasRenderingContext2D, items: DrawItem[]) {
  clearCanvas(ctx);
  for (const it of items) {
    if (it.k === 'stroke') drawStroke(ctx, it);
    else if (it.k === 'shape') drawShape(ctx, it);
    else floodFill(ctx, it.x, it.y, it.color);
  }
}
