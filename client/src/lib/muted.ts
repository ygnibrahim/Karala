// Sessize alınan oyuncular: mesajları sadece bu cihazda gizlenir (karşı taraf bilmez).
// Oyuncu kimlikleri odaya özeldir; liste küçük tutulur.
import { useSyncExternalStore } from 'react';

const KEY = 'karala:muted';
const MAX = 100;

const load = (): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(-MAX) : [];
  } catch {
    return [];
  }
};

let muted = new Set(load());
const listeners = new Set<() => void>();

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify([...muted].slice(-MAX)));
  } catch {
    /* gizli sekme vb.: sadece bu oturumda geçerli olur */
  }
  for (const l of listeners) l();
}

export function toggleMuted(playerId: string): void {
  muted = new Set(muted);
  if (muted.has(playerId)) muted.delete(playerId);
  else muted.add(playerId);
  save();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Sessize alınanlar kümesi (değişince bileşen yeniden çizilir). */
export function useMuted(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, () => muted);
}
