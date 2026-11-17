// Tek bir tuvalin çizim geçmişi ve sınırları. Klasik modda odanın tuvali, Kırık Telefon'da
// her oyuncunun kendi çizimi için kullanılır.
import { applyOp, type DrawItem, type DrawOp } from '@shared';
import { SERVER_LIMITS } from '../config';

export class DrawingBuffer {
  items: DrawItem[] = [];
  private points = 0;
  /** Son kabul edilen işlem bir çizgi başlangıcı mı? ('move' sadece açık çizgiye eklenir.) */
  private strokeOpen = false;

  /** İşlemi uygular; sınır aşılıyorsa ya da açık çizgi yoksa reddeder (false). */
  apply(op: DrawOp): boolean {
    if (op.t === 'move') {
      // Başlangıcı reddedilmiş bir çizginin noktaları önceki çizgiye eklenmesin.
      if (!this.strokeOpen || this.points + op.pts.length > SERVER_LIMITS.maxHistoryPoints) return false;
      this.points += op.pts.length;
    } else if ((op.t === 'start' || op.t === 'fill' || op.t === 'shape') && this.items.length >= SERVER_LIMITS.maxHistoryItems) {
      this.strokeOpen = false;
      return false;
    }
    if (op.t !== 'move') this.strokeOpen = op.t === 'start';
    applyOp(this.items, op);
    return true;
  }

  /** İşlem buraya ulaşmadan reddedildi (ör. istek sınırı): açık çizgiyi kapat. */
  reject(): void {
    this.strokeOpen = false;
  }

  reset(): void {
    this.items = [];
    this.points = 0;
    this.strokeOpen = false;
  }
}
