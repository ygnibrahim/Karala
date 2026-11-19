import { AVATAR_COLORS, AVATAR_FACES, type Avatar, SESSION_TOKEN_PATTERN } from '@shared';

// Depolama gizli sekmede vs. kapalı olabilir; her erişimi korumaya al.
function safeGet(store: () => Storage, key: string): string | null {
  try {
    return store().getItem(key);
  } catch {
    return null;
  }
}
function safeSet(store: () => Storage, key: string, value: string | null) {
  try {
    if (value === null) store().removeItem(key);
    else store().setItem(key, value);
  } catch {
    /* yok say */
  }
}

const local = () => window.localStorage;
const tab = () => window.sessionStorage;

/** Kriptografik olarak güçlü, URL-güvenli rastgele anahtar (güvensiz http bağlamında da çalışır). */
function randomToken(bytes = 18): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Sekme başına gizli oturum anahtarı: sayfa yenilense de aynı oyuncu olarak geri döneriz.
 * Bu anahtar sadece sunucuya gönderilir; diğer oyuncular hiçbir zaman görmez.
 */
export function getSessionId(): string {
  let id = safeGet(tab, 'karala.session');
  if (!id || !SESSION_TOKEN_PATTERN.test(id)) {
    id = randomToken();
    safeSet(tab, 'karala.session', id);
  }
  return id;
}

export interface Profile {
  name: string;
  avatar: Avatar;
}

export function loadProfile(): Profile {
  try {
    const raw = safeGet(local, 'karala.profile');
    if (raw) {
      const p = JSON.parse(raw) as Profile;
      if (p && typeof p.name === 'string' && p.avatar) return p;
    }
  } catch {
    /* yok say */
  }
  return {
    name: '',
    avatar: {
      color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
      face: AVATAR_FACES[Math.floor(Math.random() * AVATAR_FACES.length)],
    },
  };
}

export function saveProfile(p: Profile) {
  safeSet(local, 'karala.profile', JSON.stringify(p));
}

export function getActiveRoom(): string | null {
  return safeGet(tab, 'karala.room');
}

export function setActiveRoom(code: string | null) {
  safeSet(tab, 'karala.room', code);
}

/** Davet linkindeki ?oda=KOD parametresi. */
export function roomFromUrl(): string | null {
  const code = new URLSearchParams(window.location.search).get('oda');
  return code ? code.toUpperCase() : null;
}

export function setUrlRoom(code: string | null) {
  const url = new URL(window.location.href);
  if (code) url.searchParams.set('oda', code);
  else url.searchParams.delete('oda');
  window.history.replaceState(null, '', url);
}

export function inviteLink(code: string): string {
  const base = (import.meta.env.VITE_PUBLIC_URL as string | undefined) || window.location.origin + window.location.pathname;
  return `${base.replace(/\/$/, '')}/?oda=${code}`;
}

/** "Bu cihazdaki bilgilerimi sil": oyunun bu cihazda tuttuğu her şeyi (profil, tercihler, oturum) siler. */
export function clearLocalData(): void {
  for (const store of [local, tab]) {
    try {
      const s = store();
      for (const key of Object.keys(s)) if (key.startsWith('karala')) s.removeItem(key);
    } catch {
      /* depolama kapalı: silinecek bir şey yok */
    }
  }
}
