import { SCORING } from '../config';

/**
 * Doğru tahmin puanı: kalan süreye oranla guessMin..guessMax, ilk bilen ek puan alır.
 * @param timeLeftMs aşamanın bitmesine kalan süre
 * @param totalMs aşamanın toplam süresi
 */
export function guessPoints(timeLeftMs: number, totalMs: number, isFirst: boolean): number {
  const ratio = totalMs > 0 ? Math.min(1, Math.max(0, timeLeftMs / totalMs)) : 0;
  const base = SCORING.guessMin + (SCORING.guessMax - SCORING.guessMin) * ratio;
  return Math.round(base) + (isFirst ? SCORING.firstGuessBonus : 0);
}

export const DRAWER_POINTS_PER_GUESS = SCORING.drawerPerGuess;
