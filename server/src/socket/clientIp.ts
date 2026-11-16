import { IS_HOSTED } from '../config';
import type { GameSocket } from '../game/Room';

/**
 * Bağlantının gerçek IP adresi. Render gibi bir vekil sunucunun arkasındaysak istemci adresi
 * X-Forwarded-For'un ilk değeridir; değilsek bu başlık sahte olabileceği için yok sayılır.
 */
export function clientIp(socket: GameSocket): string {
  if (IS_HOSTED) {
    const forwarded = socket.handshake.headers['x-forwarded-for'];
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
    if (first) return first;
  }
  return socket.handshake.address;
}
