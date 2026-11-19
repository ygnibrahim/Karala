// Ayarlara göre kelime havuzunu oluşturur ve tekrarsız kelime seçer.
import { CUSTOM_ONLY_CATEGORY, type Lang, type Settings } from '@shared';
import { pickRandom } from '../utils/random';
import { WORDS } from './wordList';
import { WORDS_EN } from './wordListEn';

/** Dil → kategori → kelimeler. */
export const WORD_LISTS: Record<Lang, Record<string, string[]>> = { tr: WORDS, en: WORDS_EN };

export function wordPool(settings: Pick<Settings, 'category' | 'customWords' | 'language'>): string[] {
  if (settings.category === CUSTOM_ONLY_CATEGORY) return settings.customWords;
  const lists = WORD_LISTS[settings.language] ?? WORDS;
  const base = lists[settings.category] ?? lists.karisik;
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

/** Kelimenin geldiği kategorinin kimliği (Sahtekâr modunda sahtekârın tek ipucu); listede yoksa özel kelime. */
export function categoryOf(word: string, language: Lang = 'tr'): string {
  for (const [id, list] of Object.entries(WORD_LISTS[language] ?? WORDS)) {
    if (id !== 'karisik' && list.includes(word)) return id;
  }
  return CUSTOM_ONLY_CATEGORY;
}
