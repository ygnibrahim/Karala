// Galeri için: çizimleri küçük önizlemeye ve paylaşılabilir PNG'ye çevirir.
import { CANVAS_H, CANVAS_W, type DrawItem } from '@shared';
import { redraw } from './render';

/** Tek bir tam boy tuval tekrar tekrar kullanılır (30 çizim için 30 büyük tuval açılmasın). */
let scratch: HTMLCanvasElement | null = null;
function renderFull(drawing: DrawItem[]): HTMLCanvasElement {
  scratch ??= Object.assign(document.createElement('canvas'), { width: CANVAS_W, height: CANVAS_H });
  const ctx = scratch.getContext('2d', { willReadFrequently: true });
  if (ctx) redraw(ctx, drawing);
  return scratch;
}

/** Küçük önizleme (JPEG data URL). */
export function thumbnail(drawing: DrawItem[], width = 240): string {
  const full = renderFull(drawing);
  const small = Object.assign(document.createElement('canvas'), { width, height: Math.round((width * CANVAS_H) / CANVAS_W) });
  small.getContext('2d')?.drawImage(full, 0, 0, small.width, small.height);
  return small.toDataURL('image/jpeg', 0.85);
}

const BAR = 64;

/** Altında "kelime · çizen · Karala" yazan paylaşılabilir PNG. */
export function shareImage(drawing: DrawItem[], caption: string): Promise<Blob | null> {
  const full = renderFull(drawing);
  const out = Object.assign(document.createElement('canvas'), { width: CANVAS_W, height: CANVAS_H + BAR });
  const ctx = out.getContext('2d');
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(full, 0, 0);
  ctx.fillStyle = '#6c4cf5';
  ctx.fillRect(0, CANVAS_H, CANVAS_W, BAR);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.font = "800 30px 'Baloo 2', system-ui, sans-serif";
  ctx.fillText(caption, 20, CANVAS_H + BAR / 2, CANVAS_W - 180);
  ctx.textAlign = 'right';
  ctx.font = "800 28px 'Baloo 2', system-ui, sans-serif";
  ctx.fillText('Karala ✏️', CANVAS_W - 20, CANVAS_H + BAR / 2);
  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}

/** Telefonda paylaşım menüsünü açar (WhatsApp vb.); desteklenmiyorsa dosyayı indirir. */
export async function shareOrDownload(blob: Blob, fileName: string): Promise<void> {
  const file = new File([blob], fileName, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Karala' });
      return;
    } catch (e) {
      // Kullanıcı vazgeçtiyse indirme de yapma.
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: fileName });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
