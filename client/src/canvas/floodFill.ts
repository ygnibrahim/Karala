// Boya kovası: tıklanan noktadan başlayıp benzer renkli alanı boyar (satır tarama algoritması).
import { CANVAS_H, CANVAS_W } from '@shared';

/** Renklerin bu kadar farklı olduğu pikseller de "aynı alan" sayılır (kenar yumuşatma için). */
const TOLERANCE = 48;

function hexToRgba(hex: string): number {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 255,
    g = (v >> 8) & 255,
    b = v & 255;
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

  const tr = target & 255,
    tg = (target >> 8) & 255,
    tb = (target >> 16) & 255;
  const matches = (c: number) =>
    Math.abs((c & 255) - tr) <= TOLERANCE &&
    Math.abs(((c >> 8) & 255) - tg) <= TOLERANCE &&
    Math.abs(((c >> 16) & 255) - tb) <= TOLERANCE;

  const seen = new Uint8Array(CANVAS_W * CANVAS_H);
  // Yığında [x, y] çiftleri tutulur.
  const stack: number[] = [x, y];
  while (stack.length >= 2) {
    const cy = stack.pop() as number;
    let cx = stack.pop() as number;
    // Satırın soluna kadar git, sonra sağa doğru doldur (scanline).
    while (cx > 0 && !seen[cy * CANVAS_W + cx - 1] && matches(data[cy * CANVAS_W + cx - 1])) cx--;
    let up = false,
      down = false;
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
