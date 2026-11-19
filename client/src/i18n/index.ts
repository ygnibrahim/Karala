// Arayüz dili: her oyuncu kendi dilini seçer (varsayılan: cihazın dili). Metinler tr.ts / en.ts'de.
// Kullanım: const t = useT(); t('home.create') · t('chat.guessed', { name: 'Ali', points: 20 })
import type { ChatMessage, Lang } from '@shared';
import { useSyncExternalStore } from 'react';
import { en } from './en';
import { type Key, tr } from './tr';

export type { Key };
export type Vars = Record<string, string | number>;

const DICTS: Record<Lang, Record<Key, string>> = { tr, en };
const STORAGE_KEY = 'karala:lang';

function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'tr' || saved === 'en') return saved;
  } catch {
    /* gizli sekme */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('tr') ? 'tr' : 'en';
}

let lang: Lang = initialLang();
const listeners = new Set<() => void>();
if (typeof document !== 'undefined') document.documentElement.lang = lang;

export function getLang(): Lang {
  return lang;
}

export function setLang(next: Lang): void {
  if (next === lang) return;
  lang = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* gizli sekme: sadece bu oturumda geçerli */
  }
  document.documentElement.lang = next;
  for (const l of listeners) l();
}

/** Metni seçili dilde döner; {değişken} yerlerini doldurur. */
export function t(key: Key, vars?: Vars): string {
  const text = DICTS[lang][key] ?? tr[key] ?? key;
  return vars ? text.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`)) : text;
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Dil değişince bileşeni yeniden çizer ve çeviri fonksiyonunu döner. */
export function useT(): typeof t {
  useSyncExternalStore(subscribe, getLang);
  return t;
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, getLang);
}

/** Sunucunun hazır mesajını oyuncunun dilinde metne çevirir. `mode` ve `team` değişkenleri de çevrilir. */
export function messageText(m: ChatMessage): string {
  if (!m.key) return m.text;
  const vars: Vars = { ...m.vars };
  if (typeof vars.mode === 'string') vars.mode = t(`mode.${vars.mode}.name` as Key);
  if (typeof vars.team === 'string') vars.team = t(`team.${vars.team}` as Key);
  return t(`msg.${m.key}` as Key, vars);
}
