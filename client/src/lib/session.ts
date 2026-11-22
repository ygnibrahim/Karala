import { AVATAR_COLORS, AVATAR_FACES, type Avatar, SESSION_TOKEN_PATTERN } from '@shared';
import { isStandalone } from './pwa';

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
/**
 * Oturum anahtarı ve odanın tutulduğu yer. Tarayıcıda sekmeye özel (iki sekme = iki oyuncu).
 * Yüklü uygulamada (Android uygulaması, ana ekrandaki PWA) tek pencere var ve işletim sistemi onu arka
 * planda kapatabilir; sekme deposu o zaman silinir ve oyuncu odadan düşerdi. Orada kalıcı depo kullanılır.
 */
const sessionStore = (): (() => Storage) => (isStandalone() ? local : tab);

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
 * Gizli oturum anahtarı: sayfa yenilense (ya da uygulama yeniden açılsa) de aynı oyuncu olarak geri döneriz.
 * Bu anahtar sadece sunucuya gönderilir; diğer oyuncular hiçbir zaman görmez.
 */
export function getSessionId(): string {
  const store = sessionStore();
  let id = safeGet(store, 'karala.session');
  if (!id || !SESSION_TOKEN_PATTERN.test(id)) {
    id = randomToken();
    safeSet(store, 'karala.session', id);
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
  return safeGet(sessionStore(), 'karala.room');
}

export function setActiveRoom(code: string | null) {
  safeSet(sessionStore(), 'karala.room', code);
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
  // Paketli uygulamada (Capacitor) sayfa adresi telefonun içidir (https://localhost): davet/QR linki
  // o zaman oyunu da sunan sunucunun adresini kullanır.
  const base =
    (import.meta.env.VITE_PUBLIC_URL as string | undefined) ||
    (import.meta.env.VITE_SERVER_URL as string | undefined) ||
    window.location.origin + window.location.pathname;
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
