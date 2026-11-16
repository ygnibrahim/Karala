// Ayarlara göre kelime havuzunu oluşturur ve tekrarsız kelime seçer.
import { CUSTOM_ONLY_CATEGORY, type Settings } from '@shared';
import { pickRandom } from '../utils/random';
import { WORDS } from './wordList';

export function wordPool(settings: Pick<Settings, 'category' | 'customWords'>): string[] {
  if (settings.category === CUSTOM_ONLY_CATEGORY) return settings.customWords;
  const base = WORDS[settings.category] ?? WORDS.karisik;
  return [...new Set([...base, ...settings.customWords])];
}

/**
 * Havuzdan daha önce kullanılmamış n kelime seçer. Yeterli taze kelime kalmadıysa
 * kullanılanlar listesini sıfırlar (bunu `used` kümesi üzerinde yerinde yapar).
 */
export function pickWords(pool: readonly string[], used: Set<string>, n: number): string[] {
  let fresh = pool.filter((w) => !used.has(w));
  if (fresh.length < n) {
    used.clear();
    fresh = [...pool];
  }
  return pickRandom(fresh, n);
}
