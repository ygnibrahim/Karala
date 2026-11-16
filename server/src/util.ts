const FOLD: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Tahmin karşılaştırması için: Türkçe küçük harf, aksanlar sadeleşmiş, boşluksuz. */
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

/** Tahmin kelimeye "çok yakın" mı? */
export function isClose(guess: string, word: string): boolean {
  if (word.length < 4 || guess.length < 3) return false;
  const limit = word.length >= 8 ? 2 : 1;
  return levenshtein(guess, word) <= limit;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPRSTUVYZ';

export function makeRoomCode(exists: (code: string) => boolean): string {
  let code: string;
  do {
    code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
  } while (exists(code));
  return code;
}

export function pickRandom<T>(list: T[], n: number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
