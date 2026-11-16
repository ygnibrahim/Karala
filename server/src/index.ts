import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { AVATAR_COLORS, AVATAR_FACES, type Avatar, type ClientToServer, type JoinPayload, type ServerToClient } from '../../shared/protocol';
import { Room } from './Room';
import { makeRoomCode } from './util';

const PORT = Number(process.env.PORT) || 3001;

const app = express();
const httpServer = createServer(app);
const io = new Server<ClientToServer, ServerToClient>(httpServer, {
  cors: { origin: '*' },
  maxHttpBufferSize: 64 * 1024,
});

// Barındırma servisinin "sunucu ayakta mı?" kontrolü için.
app.get('/health', (_req, res) => {
  res.json({ ok: true, rooms: rooms.size });
});

// Üretimde derlenmiş istemciyi de aynı sunucudan sun (tek adres yeterli olsun).
const clientDist = fileURLToPath(new URL('../../client/dist', import.meta.url));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/.*/, (_req, res) => res.sendFile('index.html', { root: clientDist }));
}

const rooms = new Map<string, Room>();

function cleanJoin(p: JoinPayload): { sessionId: string; name: string; avatar: Avatar } | null {
  if (!p || typeof p !== 'object') return null;
  const sessionId = typeof p.sessionId === 'string' ? p.sessionId.slice(0, 64) : '';
  if (sessionId.length < 8) return null;
  const name = (typeof p.name === 'string' ? p.name.trim().replace(/\s+/g, ' ').slice(0, 16) : '') || 'Oyuncu';
  const avatar: Avatar = {
    color: AVATAR_COLORS.includes(p.avatar?.color) ? p.avatar.color : AVATAR_COLORS[0],
    face: AVATAR_FACES.includes(p.avatar?.face) ? p.avatar.face : AVATAR_FACES[0],
  };
  return { sessionId, name, avatar };
}

io.on('connection', (socket) => {
  let room: Room | null = null;
  let playerId: string | null = null;

  const enter = (target: Room, payload: JoinPayload) => {
    const info = cleanJoin(payload);
    if (!info) return 'Geçersiz bilgi.';
    if (room && room !== target && playerId) room.remove(playerId, socket);
    const error = target.join(socket, info.sessionId, info.name, info.avatar);
    if (error) return error;
    room = target;
    playerId = info.sessionId;
    return null;
  };

  socket.on('room:create', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const code = makeRoomCode((c) => rooms.has(c));
    const newRoom = new Room(io, code, (r) => rooms.delete(r.code));
    rooms.set(code, newRoom);
    const error = enter(newRoom, payload);
    if (error) {
      rooms.delete(code);
      return ack({ ok: false, error });
    }
    ack({ ok: true, code });
  });

  socket.on('room:join', (payload, ack) => {
    if (typeof ack !== 'function') return;
    const code = String(payload?.code ?? '').trim().toUpperCase();
    const target = rooms.get(code);
    if (!target) return ack({ ok: false, error: 'Böyle bir oda bulunamadı.' });
    const error = enter(target, payload);
    ack(error ? { ok: false, error } : { ok: true, code });
  });

  socket.on('room:leave', () => {
    if (room && playerId) room.remove(playerId, socket);
    room = null;
    playerId = null;
  });

  socket.on('room:settings', (s) => room && playerId && room.updateSettings(playerId, s ?? {}));
  socket.on('game:start', () => room && playerId && room.start(playerId));
  socket.on('game:restart', () => room && playerId && room.restart(playerId));
  socket.on('word:choose', (i) => room && playerId && room.chooseWord(playerId, Number(i)));
  socket.on('draw:op', (op) => room && playerId && room.draw(playerId, socket, op));
  socket.on('chat:send', (text) => room && playerId && room.chat(playerId, text));
  socket.on('react', (kind) => room && playerId && room.react(playerId, kind));

  socket.on('disconnect', () => {
    // Aynı oyuncu başka bir bağlantıyla geri döndüyse dokunma.
    if (!room || !playerId) return;
    const p = room.findPlayer(playerId);
    if (p && p.socketId === socket.id) room.disconnect(playerId);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 Karala sunucusu çalışıyor: http://localhost:${PORT}`);
});
