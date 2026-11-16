import { describe, expect, it } from 'vitest';
import { cleanText, isClose, levenshtein, normalizeGuess } from '../src/utils/text';

describe('normalizeGuess', () => {
  it('Türkçe karakterleri sadeleştirir ve büyük/küçük harfi yok sayar', () => {
    expect(normalizeGuess('ÖRDEK')).toBe('ordek');
    expect(normalizeGuess('Şarkı Söylemek')).toBe('sarkisoylemek');
    expect(normalizeGuess('IŞIK')).toBe('isik'); // Türkçe I → ı → i
    expect(normalizeGuess('İğne')).toBe('igne');
  });

  it('harf ve rakam dışındaki her şeyi atar', () => {
    expect(normalizeGuess('  ör-dek!! ')).toBe('ordek');
    expect(normalizeGuess('<script>')).toBe('script');
  });
});

describe('isClose / levenshtein', () => {
  it('bir harf farkı kısa kelimede yakın sayılır', () => {
    expect(isClose('ordak', 'ordek')).toBe(true);
    expect(isClose('kedi', 'kedi')).toBe(true);
  });

  it('uzak tahminler yakın sayılmaz', () => {
    expect(isClose('kopek', 'ordek')).toBe(false);
  });

  it('çok kısa kelimelerde "yakın" uyarısı verilmez (cevabı ele vermesin)', () => {
    expect(isClose('aa', 'ay')).toBe(false);
    expect(isClose('at', 'ay')).toBe(false);
  });

  it('levenshtein mesafesi doğru hesaplanır', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
  });
});

describe('cleanText', () => {
  it('boşlukları tekleştirir ve kırpar', () => {
    expect(cleanText('  merhaba\n\n\tdünya  ', 50)).toBe('merhaba dünya');
  });

  it('görünmez ve yön değiştirici karakterleri siler (isim taklidi)', () => {
    const sneaky = `Ali​‍‮⁦x`;
    expect(cleanText(sneaky, 50)).toBe('Alix');
  });

  it('kontrol karakterlerini siler', () => {
    expect(cleanText('a\u0000b\u0007c', 50)).toBe('abc');
  });

  it('uzunluk sınırını uygular', () => {
    expect(cleanText('x'.repeat(500), 16)).toHaveLength(16);
  });

  it('kısaltırken emojiyi ortadan bölmez', () => {
    const out = cleanText(`${'a'.repeat(15)}🎨🎨`, 16);
    expect(out).toBe(`${'a'.repeat(15)}🎨`);
    expect(Array.from(out).at(-1)).toBe('🎨'); // son karakter tam bir emoji, yarım değil
  });

  it('emoji ve Türkçe harfleri korur', () => {
    expect(cleanText('Çiğdem 🎨', 50)).toBe('Çiğdem 🎨');
  });
});
