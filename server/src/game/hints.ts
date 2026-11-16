// Harf ipuçları: süre ilerledikçe kelimenin bazı harfleri açılır.
import { HINT_THRESHOLDS } from '../config';

/** Kelime için verilecek en fazla ipucu sayısı (kısa kelimelerde hiç yok). */
export function maxHints(word: string): number {
  const letters = word.replace(/ /g, '').length;
  return letters <= 3 ? 0 : Math.min(HINT_THRESHOLDS.length, Math.floor(letters / 3));
}

/** Süre ilerlemesine (0..1) göre şu ana kadar verilmiş olması gereken ipucu sayısı. */
export function hintsDue(word: string, progress: number): number {
  const max = maxHints(word);
  return HINT_THRESHOLDS.slice(0, max).filter((t) => progress >= t).length;
}

/** Açılabilecek harf indeksleri. Son gizli harf hiçbir zaman açılmaz (kelimenin tamamı görünmesin). */
export function revealableIndexes(word: string, revealed: ReadonlySet<number>): number[] {
  const hidden = [...word].flatMap((c, i) => (c !== ' ' && !revealed.has(i) ? [i] : []));
  return hidden.length > 1 ? hidden : [];
}

/** Herkese gönderilecek maskeli kelime: '_' gizli, ' ' boşluk, açılmış harfler kendisi. */
export function maskWord(word: string, revealed: ReadonlySet<number>): string[] {
  return [...word].map((c, i) => (c === ' ' ? ' ' : revealed.has(i) ? c : '_'));
}
