// Klasik mod: baştan sona tam oyun, zaman aşımları ve oda yaşam döngüsü.
// Süreler testlerde kısaltılmıştır (vitest.config.mts → CHOOSE_MS=1500, TURN_END_MS=300).
import type { GalleryItem, RoomState } from '@shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REACTIONS } from '../src/config';
import { WORDS_EN } from '../src/game/wordListEn';
import {
  type Client,
  connectClient,
  create,
  eventsOf,
  type Game,
  join,
  nextEvent,
  payload,
  settle,
  setupRoom,
  startDrawing,
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
  it('oyun sırasında katılan oyuncu aynı turda çizme sırasına girer (son turda bile)', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('room:settings', { rounds: 2 });
    await waitForState(game.host, (s) => s.settings.rounds === 2);
    let from = game.host.log.length;
    game.host.emit('game:start');

    const drawers: { id: string | null; round: number }[] = [];
    let lateId = '';
    let late: Game['others'][number] | null = null;
    for (;;) {
      const st = await nextEvent<RoomState>(
        game.host,
        'room:state',
        (s) => s.phase === 'choosing' || s.phase === 'gameEnd',
        from,
      );
      if (st.phase === 'gameEnd') break;
      drawers.push({ id: st.drawerId, round: st.round });
      // Son turun (2. tur) ilk çizimi sırasında yeni biri gelsin.
      if (st.round === 2 && !late) {
        const socket = await connectClient(ts);
        const p = payload('Geç Gelen', { code: game.code });
        const joined = await join(socket, p);
        if (!joined.ok) throw new Error(joined.error);
        lateId = joined.playerId;
        late = { socket, id: lateId, sessionId: p.sessionId };
        game.others.push(late);
        await settle();
      }
      from = game.host.log.length;
      await playTurn(game, st);
      from = game.host.log.length;
    }
    // Geç gelen, oyun bitmeden 2. turda çizdi.
    expect(drawers.filter((d) => d.id === lateId)).toEqual([{ id: lateId, round: 2 }]);
    expect(drawers).toHaveLength(5);
  }, 30_000);

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

describe('oda dili', () => {
  it('odayı kuranın dili odanın kelime dili olur; oda sahibi değiştirebilir, kelimeler o dilden gelir', async () => {
    const host = await connectClient(ts);
    const created = await create(host, payload('Ann', { lang: 'en' }));
    if (!created.ok) throw new Error(created.error);
    expect(lastState(host).settings.language).toBe('en');
    const guest = await connectClient(ts);
    await join(guest, payload('Bob', { code: created.code }));
    // Sonradan katılanın dili odayı değiştirmez.
    expect(lastState(host).settings.language).toBe('en');

    host.emit('room:settings', { category: 'hayvanlar' });
    await waitForState(host, (s) => s.settings.category === 'hayvanlar');
    const from = host.log.length;
    host.emit('game:start');
    const choosing = await nextEvent<RoomState>(host, 'room:state', (s) => s.phase === 'choosing', from);
    const drawer = choosing.drawerId === created.playerId ? host : guest;
    const choices = await nextEvent<string[]>(drawer, 'word:choices');
    for (const w of choices) expect(WORDS_EN.hayvanlar).toContain(w);
  });

  it('geçersiz dil ayarı yok sayılır', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('room:settings', { language: 'de' });
    await settle();
    expect(lastState(game.host).settings.language).toBe('tr');
    game.host.emit('room:settings', { language: 'en' });
    await waitForState(game.host, (s) => s.settings.language === 'en');
  });
});

describe('klasik mod: tepkiler', () => {
  it('👍/👎 tur başına sınırsız; ama seri basışta kısa bekleme var, çizen tepki veremez', async () => {
    const game = await setupRoom(ts, 1);
    const { drawer, guessers } = await startDrawing(game);
    const reactions = () => eventsOf(game.host, 'reaction').length;
    const before = reactions();
    const g = guessers[0];
    g.emit('react', 'like');
    g.emit('react', 'like'); // bekleme süresi içinde: yok sayılır
    await settle();
    expect(reactions() - before).toBe(1);
    await settle(REACTIONS.cooldownMs);
    g.emit('react', 'dislike');
    await settle();
    expect(reactions() - before).toBe(2);
    await settle(REACTIONS.cooldownMs);
    g.emit('react', 'like');
    drawer.emit('react', 'like');
    await settle();
    expect(reactions() - before).toBe(3);
  });
});

describe('klasik mod: oyun sonu galerisi', () => {
  it('her turun çizimi galeriye girer; boş tur girmez; sadece oyun bitince gönderilir; yeni oyunda sıfırlanır', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('room:settings', { rounds: 2 });
    await waitForState(game.host, (s) => s.settings.rounds === 2);
    let from = game.host.log.length;
    game.host.emit('game:start');

    const words: string[] = [];
    for (let turn = 0; turn < 4; turn++) {
      const choosing = await nextEvent<RoomState>(game.host, 'room:state', (s) => s.phase === 'choosing', from);
      const drawer = everyone(game).find((p) => p.id === choosing.drawerId);
      if (!drawer) throw new Error('çizen yok');
      const before = drawer.socket.log.length;
      drawer.socket.emit('word:choose', 0);
      const word = await nextEvent<string>(drawer.socket, 'word:secret', () => true, before);
      // Son tur boş bırakılır: galeriye girmemeli.
      if (turn < 3) {
        drawer.socket.emit('draw:op', { t: 'start', color: '#000000', size: 6, x: 10, y: 10 });
        drawer.socket.emit('draw:op', { t: 'move', pts: [20, 20, 30, 30] });
        words.push(word);
      }
      await settle(50);
      from = game.host.log.length;
      const ended = nextEvent<RoomState>(game.host, 'room:state', (s) => s.phase === 'turnEnd' || s.phase === 'gameEnd', from);
      for (const p of everyone(game)) if (p !== drawer) p.socket.emit('chat:send', word);
      await ended;
      // Oyun sürerken galeri istenirse yanıt gelmez.
      if (turn === 0) {
        game.host.emit('gallery:get');
        await settle();
        expect(eventsOf(game.host, 'game:gallery')).toHaveLength(0);
      }
      from = game.host.log.length;
    }

    await nextEvent<RoomState>(game.host, 'room:state', (s) => s.phase === 'gameEnd', from);
    const got = nextEvent<GalleryItem[]>(game.others[0].socket, 'game:gallery', () => true);
    game.others[0].socket.emit('gallery:get');
    const gallery = await got;
    expect(gallery.map((g) => g.word)).toEqual(words);
    expect(gallery.every((g) => g.drawerName && g.team === null && !g.together && g.drawing.length === 1)).toBe(true);
    expect(gallery[0].drawing[0]).toMatchObject({ k: 'stroke', pts: [10, 10, 20, 20, 30, 30] });

    // Yeni oyun başlayınca galeri sıfırlanır.
    game.host.emit('game:restart');
    await waitForState(game.host, (s) => s.phase === 'lobby');
    game.host.emit('game:start');
    await waitForState(game.host, (s) => s.phase === 'choosing');
    game.host.emit('gallery:get');
    await settle();
    expect(eventsOf(game.host, 'game:gallery')).toHaveLength(0);
  }, 30_000);
});
