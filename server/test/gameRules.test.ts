import { describe, expect, it } from 'vitest';
import { SCORING } from '../src/config';
import { hintsDue, maskWord, maxHints, revealableIndexes } from '../src/game/hints';
import { guessPoints } from '../src/game/scoring';
import { pickWords, wordPool } from '../src/game/wordPicker';
import { RateLimiter } from '../src/socket/RateLimiter';

describe('guessPoints', () => {
  it('erken bilen daha çok puan alır, puan sınırlar içinde kalır', () => {
    expect(guessPoints(80_000, 80_000, false)).toBe(SCORING.guessMax);
    expect(guessPoints(0, 80_000, false)).toBe(SCORING.guessMin);
    expect(guessPoints(40_000, 80_000, false)).toBe(Math.round((SCORING.guessMin + SCORING.guessMax) / 2));
  });

  it('ilk bilen bonus alır', () => {
    expect(guessPoints(0, 80_000, true)).toBe(SCORING.guessMin + SCORING.firstGuessBonus);
  });

  it('bozuk süre değerlerinde sınır dışına çıkmaz', () => {
    expect(guessPoints(-5, 80_000, false)).toBe(SCORING.guessMin);
    expect(guessPoints(1e9, 80_000, false)).toBe(SCORING.guessMax);
    expect(guessPoints(10, 0, false)).toBe(SCORING.guessMin);
  });
});

describe('ipuçları', () => {
  it('kısa kelimelerde ipucu yok, uzunlarda en fazla 3', () => {
    expect(maxHints('ay')).toBe(0);
    expect(maxHints('kedi')).toBe(1);
    expect(maxHints('patates kızartması')).toBe(3);
  });

  it('süre ilerledikçe ipucu sayısı artar', () => {
    expect(hintsDue('patates kızartması', 0.1)).toBe(0);
    expect(hintsDue('patates kızartması', 0.6)).toBe(1);
    expect(hintsDue('patates kızartması', 0.9)).toBe(3);
    expect(hintsDue('ay', 1)).toBe(0);
  });

  it('maskeli kelime gizli harfleri asla içermez', () => {
    expect(maskWord('el sallamak', new Set())).toEqual([...'__ ________']);
    expect(maskWord('kedi', new Set([1]))).toEqual(['_', 'e', '_', '_']);
  });

  it('son gizli harf hiçbir zaman açılmaz', () => {
    expect(revealableIndexes('ab', new Set([0]))).toEqual([]);
    expect(revealableIndexes('a b', new Set())).toEqual([0, 2]);
    expect(revealableIndexes('a b', new Set([0]))).toEqual([]);
  });
});

describe('kelime seçimi', () => {
  it('aynı oyunda kelimeleri tekrar etmez', () => {
    const pool = ['a1', 'a2', 'a3', 'a4', 'a5', 'a6'];
    const used = new Set<string>();
    const first = pickWords(pool, used, 3);
    for (const w of first) used.add(w);
    const second = pickWords(pool, used, 3);
    expect(new Set([...first, ...second]).size).toBe(6);
  });

  it('kelime kalmayınca listeyi sıfırlar', () => {
    const used = new Set(['a1', 'a2']);
    expect(pickWords(['a1', 'a2', 'a3'], used, 3)).toHaveLength(3);
    expect(used.size).toBe(0);
  });

  it('"sadece özel kelimeler" modunda yalnız özel kelimeler kullanılır', () => {
    expect(wordPool({ category: 'ozel', customWords: ['x', 'y'], language: 'tr' })).toEqual(['x', 'y']);
    expect(wordPool({ category: 'hayvanlar', customWords: ['zz'], language: 'tr' })).toContain('zz');
  });
});

describe('RateLimiter', () => {
  it('kapasite kadar isteğe izin verir, sonra reddeder', () => {
    let now = 0;
    const limiter = new RateLimiter({ chat: { capacity: 3, perSecond: 1 } }, () => now);
    expect([1, 2, 3, 4].map(() => limiter.take('chat'))).toEqual([true, true, true, false]);
    now += 1000;
    expect(limiter.take('chat')).toBe(true);
    expect(limiter.take('chat')).toBe(false);
  });

  it('kova kapasitesinden fazla dolmaz', () => {
    let now = 0;
    const limiter = new RateLimiter({ draw: { capacity: 2, perSecond: 10 } }, () => now);
    now += 60_000;
    expect([1, 2, 3].map(() => limiter.take('draw'))).toEqual([true, true, false]);
  });

  it('olay türleri birbirinden bağımsızdır', () => {
    const limiter = new RateLimiter({ a: { capacity: 1, perSecond: 0 }, b: { capacity: 1, perSecond: 0 } }, () => 0);
    expect(limiter.take('a')).toBe(true);
    expect(limiter.take('a')).toBe(false);
    expect(limiter.take('b')).toBe(true);
  });
});
