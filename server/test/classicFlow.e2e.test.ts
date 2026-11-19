// Klasik mod: baştan sona tam oyun, zaman aşımları ve oda yaşam döngüsü.
// Süreler testlerde kısaltılmıştır (vitest.config.mts → CHOOSE_MS=1500, TURN_END_MS=300).
import type { RoomState } from '@shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  type Client,
  eventsOf,
  type Game,
  nextEvent,
  settle,
  setupRoom,
  startServer,
  type TestServer,
  waitForState,
} from './helpers';

let ts: TestServer;
beforeEach(async () => {
  ts = await startServer();
});
afterEach(async () => {
  await ts.stop();
});

const lastState = (c: Client) => eventsOf(c, 'room:state').at(-1) as RoomState;
const everyone = (game: Game) => [{ socket: game.host, id: game.hostId }, ...game.others];

/** Sıradaki turu oynatır: çizen ilk kelimeyi seçer, herkes bilir. Tur sonu durumunu döner. */
async function playTurn(game: Game, choosing: RoomState): Promise<RoomState> {
  const drawer = everyone(game).find((p) => p.id === choosing.drawerId);
  if (!drawer) throw new Error('çizen yok');
  const before = drawer.socket.log.length;
  drawer.socket.emit('word:choose', 0);
  const word = await nextEvent<string>(drawer.socket, 'word:secret', () => true, before);
  const from = game.host.log.length;
  const ended = nextEvent<RoomState>(game.host, 'room:state', (s) => s.phase === 'turnEnd' || s.phase === 'gameEnd', from);
  for (const p of everyone(game)) if (p !== drawer) p.socket.emit('chat:send', word);
  return ended;
}

describe('klasik mod: tam oyun', () => {
  it('2 tur × 2 oyuncu: herkes sırayla çizer, oyun biter, puanlar birikir, tekrar oynanır', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('room:settings', { rounds: 2 });
    await waitForState(game.host, (s) => s.settings.rounds === 2);
    let from = game.host.log.length;
    game.host.emit('game:start');

    const drawers: (string | null)[] = [];
    for (let turn = 0; turn < 4; turn++) {
      const choosing = await nextEvent<RoomState>(game.host, 'room:state', (s) => s.phase === 'choosing', from);
      drawers.push(choosing.drawerId);
      expect(choosing.round).toBe(turn < 2 ? 1 : 2);
      from = game.host.log.length;
      const end = await playTurn(game, choosing);
      expect(end.turnResult?.reason).toBe('allGuessed');
      from = game.host.log.length;
    }
    // Her oyuncu her turda bir kez çizdi.
    expect(drawers.filter((d) => d === game.hostId)).toHaveLength(2);
    expect(drawers.filter((d) => d === game.others[0].id)).toHaveLength(2);

    const over = await nextEvent<RoomState>(game.host, 'room:state', (s) => s.phase === 'gameEnd', from);
    expect(over.players.every((p) => p.score > 0)).toBe(true);
    // Sadece oda sahibi yeniden başlatabilir; yeni oyunda puanlar sıfırlanır.
    game.others[0].socket.emit('game:restart');
    await settle();
    expect(lastState(game.host).phase).toBe('gameEnd');
    game.host.emit('game:restart');
    const lobby = await waitForState(game.host, (s) => s.phase === 'lobby');
    expect(lobby.players.every((p) => p.score === 0)).toBe(true);
  }, 30_000);

  it('çizen kelime seçmezse süre dolunca biri otomatik seçilir', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('game:start');
    const choosing = await waitForState(game.host, (s) => s.phase === 'choosing');
    const drawer = everyone(game).find((p) => p.id === choosing.drawerId);
    const choices = await nextEvent<string[]>(drawer?.socket as Client, 'word:choices');
    const word = await nextEvent<string>(drawer?.socket as Client, 'word:secret');
    expect(choices).toContain(word);
    expect(lastState(game.host).phase).toBe('drawing');
  });

  it('oyun sırasında ayarlar değiştirilemez', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('game:start');
    await waitForState(game.host, (s) => s.phase === 'choosing');
    game.host.emit('room:settings', { rounds: 10, mode: 'telephone' });
    await settle();
    expect(lastState(game.host).settings).toMatchObject({ rounds: 3, mode: 'classic' });
  });
});

describe('oda yaşam döngüsü', () => {
  it('"Çık" diyen oda sahibinin yerine hemen başkası geçer', async () => {
    const game = await setupRoom(ts, 2);
    game.host.emit('room:leave');
    const state = await waitForState(game.others[0].socket, (s) => s.players.length === 2);
    const newHost = state.players.find((p) => p.isHost);
    expect(newHost?.id).toBe(game.others[0].id);
    // Yeni oda sahibi ayarları değiştirebilir.
    game.others[0].socket.emit('room:settings', { rounds: 5 });
    await waitForState(game.others[0].socket, (s) => s.settings.rounds === 5);
  });

  it('herkes çıkınca oda sunucudan silinir', async () => {
    const game = await setupRoom(ts, 1);
    expect(ts.server.rooms.size).toBe(1);
    game.host.emit('room:leave');
    game.others[0].socket.emit('room:leave');
    await settle();
    expect(ts.server.rooms.size).toBe(0);
  });

  it('bağlantısı kopan herkes süre dolunca çıkarılır ve oda silinir', async () => {
    const game = await setupRoom(ts, 1);
    game.host.disconnect();
    game.others[0].socket.disconnect();
    await settle(2500);
    expect(ts.server.rooms.size).toBe(0);
  });
});
