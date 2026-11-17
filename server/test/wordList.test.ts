// Kelime havuzunun kalite kuralları.
import { CATEGORIES, CUSTOM_ONLY_CATEGORY } from '@shared';
import { describe, expect, it } from 'vitest';
import { WORDS } from '../src/game/wordList';
import { categoryOf } from '../src/game/wordPicker';

const realCategories = Object.keys(WORDS).filter((id) => id !== 'karisik');

describe('kelime havuzu', () => {
  it('lobideki her kategorinin kelimeleri var ve her kelime listesi bir kategoriye karşılık geliyor', () => {
    const lobbyIds = CATEGORIES.map((c) => c.id).filter((id) => id !== CUSTOM_ONLY_CATEGORY);
    expect(new Set(lobbyIds)).toEqual(new Set(Object.keys(WORDS)));
  });

  it('her kategoride en az 50 kelime var, toplam en az 1200', () => {
    for (const id of realCategories) expect(WORDS[id].length, id).toBeGreaterThanOrEqual(50);
    expect(WORDS.karisik.length).toBeGreaterThanOrEqual(1200);
  });

  it('bir kelime yalnızca tek kategoride ve tek kez geçer (Sahtekâr ipucu doğru olsun)', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const id of realCategories) {
      for (const word of WORDS[id]) {
        const previous = seen.get(word);
        if (previous) duplicates.push(`${word} (${previous}, ${id})`);
        seen.set(word, id);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('kelimeler küçük harf, düzgün biçimli ve makul uzunlukta', () => {
    const bad = WORDS.karisik.filter(
      (w) =>
        w !== w.toLocaleLowerCase('tr') ||
        w !== w.trim() ||
        /\s{2,}/.test(w) ||
        w.length < 2 ||
        w.length > 30 ||
        !/^[a-zçğıöşüâîû0-9' -]+$/.test(w),
    );
    expect(bad).toEqual([]);
  });

  it('kategori ipucu doğru bulunur', () => {
    expect(categoryOf('kedi')).toBe('Hayvanlar');
    expect(categoryOf('simit')).toBe('Yiyecek & İçecek');
    expect(categoryOf('baklava')).toBe("Türkiye'den");
    expect(categoryOf('listede olmayan kelime')).toBe('Özel kelime');
  });
});
