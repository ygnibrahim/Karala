// Bağlantıyı ayakta tutan önlemler.
import { socket } from './socket';

const serverUrl = (import.meta.env.VITE_SERVER_URL as string | undefined) ?? '';

/** Ücretsiz sunucu uzun süre HTTP isteği almazsa uyuyabilir: oyun sırasında ara ara haber ver. */
const KEEP_ALIVE_MS = 4 * 60_000;

/**
 * Telefon ekranı açılınca / sekmeye dönülünce bağlantı kopmuşsa beklemeden yeniden bağlan.
 * (Socket.IO kendisi de dener ama artan bekleme süresiyle; kullanıcı döndüğünde gecikme olmasın.)
 */
export function reconnectOnReturn(): () => void {
  const onVisible = () => {
    if (document.visibilityState === 'visible' && !socket.connected) socket.connect();
  };
  const onOnline = () => {
    if (!socket.connected) socket.connect();
  };
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', onOnline);
  return () => {
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('online', onOnline);
  };
}

/** Odadayken sunucuya düzenli küçük istek atar. Dönen fonksiyon durdurur. */
export function keepServerAwake(): () => void {
  const ping = () => {
    fetch(`${serverUrl}/health`, { cache: 'no-store' }).catch(() => {
      /* bağlantı yoksa bir sonrakinde denenir */
    });
  };
  const id = setInterval(ping, KEEP_ALIVE_MS);
  return () => clearInterval(id);
}
