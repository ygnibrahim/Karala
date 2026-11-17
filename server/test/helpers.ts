// Uçtan uca testler için yardımcılar: gerçek bir sunucu başlatır ve sahte oyuncular bağlar.
import type { AddressInfo } from 'node:net';
import type { AckResult, ClientToServer, JoinPayload, RoomState, ServerToClient } from '@shared';
import { io as connect, type Socket } from 'socket.io-client';
import { expect } from 'vitest';
import { createKaralaServer, type KaralaServer } from '../src/app';

export type Client = Socket<ServerToClient, ClientToServer> & {
  /** Bu istemcinin aldığı tüm olaylar (sıralı). */
  log: { event: string; args: unknown[] }[];
};

export interface TestServer {
  server: KaralaServer;
  url: string;
  clients: Client[];
  stop(): Promise<void>;
}

export async function startServer(): Promise<TestServer> {
  const server = createKaralaServer({ serveClient: false });
  await new Promise<void>((resolve) => server.httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = server.httpServer.address() as AddressInfo;
  const clients: Client[] = [];
  return {
    server,
    url: `http://127.0.0.1:${port}`,
    clients,
    async stop() {
      for (const c of clients) c.disconnect();
      await server.close();
    },
  };
}

let sessionCounter = 0;
export const newSessionId = () => `test-session-${Date.now()}-${++sessionCounter}`.padEnd(24, 'x');

export async function connectClient(ts: TestServer): Promise<Client> {
  const socket = connect(ts.url, { transports: ['websocket'], forceNew: true, reconnection: false }) as Client;
  socket.log = [];
  socket.onAny((event, ...args) => socket.log.push({ event, args }));
  ts.clients.push(socket);
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve());
    socket.once('connect_error', reject);
  });
  return socket;
}

export function payload(name: string, extra: Partial<JoinPayload> = {}): JoinPayload {
  return { name, avatar: { color: '#ff6b6b', face: '😀' }, sessionId: newSessionId(), ...extra };
}

export function create(socket: Client, p: JoinPayload): Promise<AckResult> {
  return socket.timeout(3000).emitWithAck('room:create', p);
}

export function join(socket: Client, p: JoinPayload): Promise<AckResult> {
  return socket.timeout(3000).emitWithAck('room:join', p);
}

/** Bir olayın (isteğe bağlı koşulu sağlayarak) gelmesini bekler. */
export function waitFor<T = unknown>(
  socket: Client,
  event: string,
  match: (arg: T) => boolean = () => true,
  ms = 3000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.offAny(handler);
      reject(new Error(`"${event}" olayı ${ms} ms içinde gelmedi`));
    }, ms);
    const handler = (name: string, arg: T) => {
      if (name === event && match(arg)) {
        clearTimeout(timer);
        socket.offAny(handler);
        resolve(arg);
      }
    };
    socket.onAny(handler);
  });
}

export const waitForState = (socket: Client, match: (s: RoomState) => boolean, ms = 3000) =>
  waitFor<RoomState>(socket, 'room:state', match, ms);
/** Olayların sunucuya ulaşıp işlenmesi için kısa bir bekleme. */
export const settle = (ms = 150) => new Promise((r) => setTimeout(r, ms));

export const eventsOf = (socket: Client, event: string) => socket.log.filter((e) => e.event === event).map((e) => e.args[0]);

export interface Game {
  host: Client;
  hostId: string;
  hostSession: string;
  others: { socket: Client; id: string; sessionId: string }[];
  code: string;
}

/** Oda kurar, `extra` kadar oyuncu katar. */
export async function setupRoom(ts: TestServer, extra: number): Promise<Game> {
  const host = await connectClient(ts);
  const hostPayload = payload('Ev Sahibi');
  const created = await create(host, hostPayload);
  if (!created.ok) throw new Error(created.error);
  const others: Game['others'] = [];
  for (let i = 0; i < extra; i++) {
    const socket = await connectClient(ts);
    const p = payload(`Oyuncu${i + 1}`, { code: created.code });
    const joined = await join(socket, p);
    if (!joined.ok) throw new Error(joined.error);
    others.push({ socket, id: joined.playerId, sessionId: p.sessionId });
  }
  return { host, hostId: created.playerId, hostSession: hostPayload.sessionId, others, code: created.code };
}

/** Oyunu başlatır, çizenin ilk kelimeyi seçmesini sağlar ve çizim aşamasına geçer. */
export async function startDrawing(game: Game): Promise<{ drawer: Client; drawerId: string; guessers: Client[]; word: string }> {
  const everyone = [{ socket: game.host, id: game.hostId }, ...game.others];
  const choosing = waitForState(game.host, (s) => s.phase === 'choosing');
  game.host.emit('game:start');
  const state = await choosing;
  const drawerEntry = everyone.find((p) => p.id === state.drawerId);
  if (!drawerEntry) throw new Error('çizen bulunamadı');
  const choices =
    (eventsOf(drawerEntry.socket, 'word:choices').at(-1) as string[] | undefined) ??
    (await waitFor<string[]>(drawerEntry.socket, 'word:choices'));
  const secret = waitFor<string>(drawerEntry.socket, 'word:secret');
  drawerEntry.socket.emit('word:choose', 0);
  const word = await secret;
  expect(word).toBe(choices[0]);
  return {
    drawer: drawerEntry.socket,
    drawerId: drawerEntry.id,
    guessers: everyone.filter((p) => p !== drawerEntry).map((p) => p.socket),
    word,
  };
}

/** Bağlantı kopmasını canlandırır: eski socket kapanır, aynı oturumla yeni bağlantı kurulup odaya geri dönülür. */
export async function reconnect(
  ts: TestServer,
  old: Client,
  name: string,
  sessionId: string,
  code: string,
): Promise<{ socket: Client; res: AckResult }> {
  old.disconnect();
  await settle(100);
  const socket = await connectClient(ts);
  const res = await join(socket, payload(name, { code, sessionId }));
  return { socket, res };
}
