import { SCORING } from '../config';

/**
 * Doğru tahmin puanı bilme sırasına göre: ilk bilen 15, sonraki 13, 11… (en az 5).
 * @param order kendisinden önce bilen oyuncu sayısı (ilk bilen için 0)
 */
export function guessPoints(order: number): number {
  const n = Number.isFinite(order) ? Math.max(0, Math.floor(order)) : 0;
  return Math.max(SCORING.guessMin, SCORING.firstGuess - SCORING.guessStep * n);
}

export const DRAWER_POINTS_PER_GUESS = SCORING.drawerPerGuess;
