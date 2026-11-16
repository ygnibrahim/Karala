import { randomBytes, randomInt } from 'node:crypto';

// Karıştırılması kolay harfler (I, O, Q, W, X) yok: kodu sesli söylemek/yazmak kolay olsun.
const CODE_CHARS = 'ABCDEFGHJKLMNPRSTUVYZ';

export function makeRoomCode(length: number, exists: (code: string) => boolean): string {
  let code: string;
  do {
    code = Array.from({ length }, () => CODE_CHARS[randomInt(CODE_CHARS.length)]).join('');
  } while (exists(code));
  return code;
}

/** Tahmin edilemez, herkese açık kimlik (oyuncu id'si gibi). */
export function randomId(): string {
  return randomBytes(9).toString('base64url');
}

/** Listeden tekrarsız n eleman seçer (Fisher–Yates). */
export function pickRandom<T>(list: readonly T[], n: number): T[] {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

export function randomItem<T>(list: readonly T[]): T {
  return list[randomInt(list.length)];
}
