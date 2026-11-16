// Metin yardımcıları: temizleme ve tahmin karşılaştırması.

const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/**
 * Her türlü boşluğu (satır sonu, sekme vb.) tek boşluğa çevirir, ardından kontrol, biçim ve
 * görünmez karakterleri (sıfır genişlikli boşluk, yazı yönü değiştirici vb.) siler.
 * İsimlerde taklidin ve mesajlarda görsel bozulmanın önüne geçer.
 */
export function cleanText(text: string, maxLength: number): string {
  const cleaned = text
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .replace(/[\p{Cc}\p{Cf}\p{Co}\p{Cn}]/gu, '')
    .trim();
  // Kod noktası bazında kısalt: emoji gibi iki birimlik karakterler ortadan bölünmesin.
  const chars = Array.from(cleaned);
  return chars.length > maxLength ? chars.slice(0, maxLength).join('').trim() : cleaned;
}

/** Tahmin karşılaştırması için: Türkçe küçük harf, aksanlar sadeleşmiş, harf/rakam dışı yok. */
export function normalizeGuess(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşüâîû]/g, (c) => FOLD[c] ?? c)
    .replace(/[^a-z0-9]/g, '');
}

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/** Normalleştirilmiş tahmin, normalleştirilmiş kelimeye "çok yakın" mı? */
export function isClose(guess: string, word: string): boolean {
  if (word.length < 4 || guess.length < 3) return false;
  const limit = word.length >= 8 ? 2 : 1;
  return levenshtein(guess, word) <= limit;
}
