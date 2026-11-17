// Her socket bağlantısı için olay işleyicileri.
// Görevleri: istek sınırlama, gelen veriyi doğrulama ve doğru odaya iletme. Oyun kuralları Room'da.
import type { AckResult, JoinPayload } from '@shared';
import { IP_RATE_LIMITS, RATE_LIMITS } from '../config';
import type { GameSocket, IO, Room } from '../game/Room';
import type { RoomManager } from '../game/RoomManager';
import { sanitizeDrawOp } from '../validation/drawOp';
import { sanitizeChat, sanitizeJoin, sanitizeRoomCode } from '../validation/player';
import { clientIp } from './clientIp';
import { KeyedRateLimiter } from './KeyedRateLimiter';
import { RateLimiter } from './RateLimiter';

const TOO_FAST = 'Çok hızlı! Biraz bekleyip tekrar dene.';
/** Reddedilen çizimlerden sonra çizenin ekranı en fazla bu sıklıkta yeniden eşitlenir. */
const RESYNC_INTERVAL_MS = 500;

export function registerHandlers(io: IO, rooms: RoomManager): void {
  // Tüm bağlantılarda ortak: aynı IP'den çok sayıda bağlantıyla oda yağdırılmasın.
  const ipLimiter = new KeyedRateLimiter(IP_RATE_LIMITS);

  io.on('connection', (socket: GameSocket) => {
    const limiter = new RateLimiter(RATE_LIMITS);
    const ip = clientIp(socket);
    let room: Room | null = null;
    let playerId: string | null = null;
    let lastResync = 0;

    /** Bu socket odadaki oyuncunun güncel bağlantısı mı? (Aynı oturum başka sekmede açıldıysa değil.) */
    const isActive = (): boolean => !!room && !!playerId && room.isActiveSocket(playerId, socket.id);

    /** Socket'i bir odaya sokar. Başka bir odadaysa ancak yeni odaya girebildikten sonra eskisinden çıkar. */
    const enter = (target: Room, payload: unknown): AckResult => {
      const info = sanitizeJoin(payload);
      if (!info) return { ok: false, error: 'Geçersiz bilgi.' };
      const result = target.join(socket, info.sessionId, info.name, info.avatar);
      if (!result.ok) return result;
      if (room && room !== target && playerId) room.remove(playerId, socket);
      room = target;
      playerId = result.playerId;
      return { ok: true, code: target.code, playerId: result.playerId };
    };

    /** Odadaki oyuncu olarak, istek sınırı dahilinde bir işlem çalıştırır. */
    const asPlayer =
      <A extends unknown[]>(bucket: keyof typeof RATE_LIMITS, fn: (room: Room, playerId: string, ...args: A) => void) =>
      (...args: A) => {
        if (!room || !playerId || !isActive() || !limiter.take(bucket)) return;
        fn(room, playerId, ...args);
      };

    /** Reddedilen çizimden sonra çizenin ekranını sunucudaki haliyle eşitler (sık tekrarlanmaz). */
    const resync = (send: () => void) => {
      const now = Date.now();
      if (now - lastResync < RESYNC_INTERVAL_MS) return;
      lastResync = now;
      send();
    };

    socket.on('room:create', (payload: JoinPayload, ack: (r: AckResult) => void) => {
      if (typeof ack !== 'function') return;
      if (!limiter.take('room') || !ipLimiter.take(ip, 'room')) return ack({ ok: false, error: TOO_FAST });
      const newRoom = rooms.create();
      if (!newRoom) return ack({ ok: false, error: 'Sunucu şu an çok yoğun, birazdan tekrar dene.' });
      const result = enter(newRoom, payload);
      if (!result.ok) rooms.discard(newRoom);
      ack(result);
    });

    socket.on('room:join', (payload: JoinPayload, ack: (r: AckResult) => void) => {
      if (typeof ack !== 'function') return;
      if (!limiter.take('room')) return ack({ ok: false, error: TOO_FAST });
      const code = sanitizeRoomCode((payload as Partial<JoinPayload> | undefined)?.code);
      const target = code ? rooms.get(code) : undefined;
      if (!target) return ack({ ok: false, error: 'Böyle bir oda bulunamadı.' });
      ack(enter(target, payload));
    });

    socket.on('room:leave', () => {
      // Eski bir sekme, oyuncunun güncel bağlantısını odadan atamasın.
      if (room && playerId && isActive()) room.remove(playerId, socket);
      else room?.leaveChannel(socket);
      room = null;
      playerId = null;
    });

    socket.on(
      'room:settings',
      asPlayer('action', (r, id, s: unknown) => r.updateSettings(id, s)),
    );
    socket.on(
      'game:start',
      asPlayer('action', (r, id) => r.start(id)),
    );
    socket.on(
      'game:restart',
      asPlayer('action', (r, id) => r.restart(id)),
    );
    socket.on(
      'word:choose',
      asPlayer('action', (r, id, index: unknown) => {
        if (Number.isInteger(index)) r.chooseWord(id, index as number);
      }),
    );
    socket.on(
      'react',
      asPlayer('action', (r, id, kind: unknown) => {
        if (kind === 'like' || kind === 'dislike') r.react(id, kind);
      }),
    );
    socket.on(
      'chat:send',
      asPlayer('chat', (r, id, text: unknown) => {
        const clean = sanitizeChat(text);
        if (clean) r.chat(id, clean);
      }),
    );

    socket.on('draw:op', (input: unknown) => {
      if (!room || !playerId || !isActive() || !room.canDraw(playerId)) return;
      const op = sanitizeDrawOp(input);
      if (!op) return;
      // Boya kovası her istemcide pahalı bir işlem: ayrıca sınırla.
      const allowed = limiter.take('draw') && (op.t !== 'fill' || limiter.take('fill'));
      if (!allowed) room.rejectDraw();
      if (!allowed || !room.draw(socket, playerId, op)) resync(() => room?.sendHistory(socket));
    });

    // ---- Kırık Telefon ----
    socket.on(
      'tp:submit',
      asPlayer('action', (r, id, step: unknown, text: unknown) => {
        if (!Number.isInteger(step)) return;
        r.telephoneSubmit(id, step as number, text === undefined || text === null ? null : sanitizeChat(text));
      }),
    );
    socket.on('tp:draw', (step: unknown, input: unknown) => {
      if (!room || !playerId || !isActive() || !Number.isInteger(step)) return;
      const op = sanitizeDrawOp(input);
      if (!op) return;
      const allowed = limiter.take('draw') && (op.t !== 'fill' || limiter.take('fill'));
      if (!allowed) room.telephoneRejectDraw(playerId);
      const id = playerId;
      if (!allowed || !room.telephoneDraw(id, step as number, op)) resync(() => room?.telephoneResync(socket, id));
    });
    socket.on(
      'tp:next',
      asPlayer('action', (r, id) => r.telephoneNext(id)),
    );
    socket.on(
      'tp:laugh',
      asPlayer('action', (r, id) => r.telephoneLaugh(id)),
    );

    // ---- Sahtekâr ----
    socket.on(
      'imp:done',
      asPlayer('action', (r, id) => r.impostorDone(id)),
    );
    socket.on(
      'imp:vote',
      asPlayer('action', (r, id, target: unknown) => {
        if (typeof target === 'string') r.impostorVote(id, target);
      }),
    );
    socket.on(
      'imp:guess',
      asPlayer('action', (r, id, text: unknown) => {
        const clean = sanitizeChat(text);
        if (clean) r.impostorGuess(id, clean);
      }),
    );

    socket.on('disconnect', () => {
      // Oyuncu bu arada başka bir bağlantıyla döndüyse dokunma.
      if (room && playerId && isActive()) room.disconnect(playerId);
    });
  });
}
