// Kelime havuzunun kalite kuralları.
import { CATEGORIES, CUSTOM_ONLY_CATEGORY } from '@shared';
import { describe, expect, it } from 'vitest';
import { WORDS } from '../src/game/wordList';
import { WORDS_EN } from '../src/game/wordListEn';
import { categoryOf, wordPool } from '../src/game/wordPicker';
import { containsProfanity } from '../src/moderation/profanity';

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
    expect(categoryOf('kedi')).toBe('hayvanlar');
    expect(categoryOf('simit')).toBe('yiyecekler');
    expect(categoryOf('baklava')).toBe('turkiye');
    expect(categoryOf('listede olmayan kelime')).toBe('ozel');
    expect(categoryOf('giraffe', 'en')).toBe('hayvanlar');
    expect(categoryOf('kedi', 'en')).toBe('ozel');
  });
});

describe('English word pool', () => {
  const en = Object.keys(WORDS_EN).filter((id) => id !== 'karisik');

  it('has the same categories as the Turkish pool', () => {
    expect(new Set(Object.keys(WORDS_EN))).toEqual(new Set(Object.keys(WORDS)));
  });

  it('every category has at least 50 words, at least 1000 in total', () => {
    for (const id of en) expect(WORDS_EN[id].length, id).toBeGreaterThanOrEqual(50);
    expect(WORDS_EN.karisik.length).toBeGreaterThanOrEqual(1000);
  });

  it('a word appears in only one category, once', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const id of en) {
      for (const word of WORDS_EN[id]) {
        const previous = seen.get(word);
        if (previous) duplicates.push(`${word} (${previous}, ${id})`);
        seen.set(word, id);
      }
    }
    expect(duplicates).toEqual([]);
  });

  it('words are lowercase, well formed and not flagged by the profanity filter', () => {
    const bad = WORDS_EN.karisik.filter(
      (w) =>
        w !== w.toLowerCase() || w !== w.trim() || /\s{2,}/.test(w) || w.length < 2 || w.length > 30 || !/^[a-z0-9' -]+$/.test(w),
    );
    expect(bad).toEqual([]);
    expect(WORDS_EN.karisik.filter(containsProfanity)).toEqual([]);
  });

  it('the pool follows the room language', () => {
    expect(wordPool({ category: 'hayvanlar', customWords: [], language: 'en' })).toContain('giraffe');
    expect(wordPool({ category: 'hayvanlar', customWords: [], language: 'tr' })).toContain('zürafa');
  });
});
