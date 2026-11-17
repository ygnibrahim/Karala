// Kırık Telefon: zincir dönüşü kuralları + uçtan uca oyun ve hile denemeleri.
import type { DrawItem, RevealData, RoomState, TelephoneTask } from '@shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { chainIndexFor, stepKind, totalStepsFor } from '../src/game/TelephoneGame';
import {
  type Client,
  connectClient,
  eventsOf,
  type Game,
  join,
  payload,
  settle,
  setupRoom,
  startServer,
  type TestServer,
  waitFor,
  waitForState,
} from './helpers';

describe('zincir kuralları', () => {
  it('adım türleri: yaz, çiz, tahmin, çiz, tahmin…', () => {
    expect([0, 1, 2, 3, 4].map(stepKind)).toEqual(['write', 'draw', 'guess', 'draw', 'guess']);
  });

  it('her oyuncu her zincire tam bir kez katkı verir', () => {
    for (const n of [3, 4, 5, 8]) {
      for (let player = 0; player < n; player++) {
        const chains = Array.from({ length: n }, (_, step) => chainIndexFor(player, step, n));
        expect(new Set(chains).size).toBe(n);
      }
      // Her adımda her zincirde tam bir oyuncu çalışır.
      for (let step = 0; step < n; step++) {
        const chains = Array.from({ length: n }, (_, player) => chainIndexFor(player, step, n));
        expect(new Set(chains).size).toBe(n);
      }
    }
  });

  it('kalabalık odada adım sayısı sınırlanır', () => {
    expect(totalStepsFor(3)).toBe(3);
    expect(totalStepsFor(12)).toBe(8);
  });
});

let ts: TestServer;
beforeEach(async () => {
  ts = await startServer();
});
afterEach(async () => {
  await ts.stop();
});

const lastTask = (c: Client) => eventsOf(c, 'tp:task').at(-1) as TelephoneTask | undefined;
const waitTask = (c: Client, step: number) => waitFor<TelephoneTask>(c, 'tp:task', (t) => t.step === step);

/** 3 oyunculu odada Kırık Telefon'u başlatır; oyuncuları oyun sırasıyla döner. */
async function startTelephone(game: Game): Promise<Client[]> {
  game.host.emit('room:settings', { mode: 'telephone' });
  await waitForState(game.host, (s) => s.settings.mode === 'telephone');
  const everyone = [game.host, ...game.others.map((o) => o.socket)];
  const tasks = everyone.map((c) => waitTask(c, 0));
  game.host.emit('game:start');
  await Promise.all(tasks);
  return everyone;
}

const stroke = (x: number) => [
  { t: 'start', color: '#000000', size: 6, x, y: 10 },
  { t: 'move', pts: [x + 5, 20, x + 10, 30] },
];

describe('Kırık Telefon uçtan uca', () => {
  it('yaz → çiz → tahmin → gösterim → gülme puanları → oyun sonu', async () => {
    const game = await setupRoom(ts, 2);
    const players = await startTelephone(game);
    const state = (eventsOf(game.host, 'room:state').at(-1) as RoomState).telephone;
    expect(state).toMatchObject({ step: 0, kind: 'write', totalSteps: 3 });

    // Adım 0: herkes yazar.
    for (const p of players) expect(lastTask(p)).toMatchObject({ kind: 'write', prompt: null });
    expect(lastTask(players[0])?.suggestion).toBeTruthy();
    let next = players.map((c) => waitTask(c, 1));
    players.forEach((p, i) => {
      p.emit('tp:submit', 0, `fikir ${i}`);
    });
    const drawTasks = await Promise.all(next);

    // Adım 1: herkes solundakinin yazdığını çizer (kendi yazdığını değil).
    drawTasks.forEach((task, i) => {
      expect(task.kind).toBe('draw');
      const from = chainIndexFor(i, 1, 3); // bu zinciri adım 0'da yazan oyuncu
      expect(task.prompt).toEqual({ text: `fikir ${from}` });
      expect(from).not.toBe(i);
    });
    next = players.map((c) => waitTask(c, 2));
    players.forEach((p, i) => {
      for (const op of stroke(i * 100)) p.emit('tp:draw', 1, op as never);
      p.emit('tp:submit', 1);
    });
    const guessTasks = await Promise.all(next);

    // Adım 2: herkes bir başkasının çizimini görür.
    guessTasks.forEach((task, i) => {
      expect(task.kind).toBe('guess');
      const drawing = (task.prompt as { drawing: DrawItem[] }).drawing;
      expect(drawing).toHaveLength(1);
      const drawnBy = drawing[0].k === 'stroke' ? drawing[0].pts[0] / 100 : -1;
      expect(drawnBy).not.toBe(i);
    });

    const revealed = waitFor<RevealData>(game.host, 'tp:reveal');
    players.forEach((p, i) => {
      p.emit('tp:submit', 2, `tahmin ${i}`);
    });
    const first = await revealed;
    expect(first.chain).toBe(0);
    expect(first.entries).toHaveLength(1);
    expect(first.entries[0]).toMatchObject({ kind: 'text', text: 'fikir 0' });

    // Gülme: yazar kendine gülemez, başkası bir kez gülebilir.
    const authorId = first.entries[0].authorId;
    const authorIndex = players.findIndex((_, i) => i === 0);
    players[authorIndex].emit('tp:laugh');
    players[1].emit('tp:laugh');
    players[1].emit('tp:laugh');
    players[2].emit('tp:laugh');
    const laughed = await waitForState(game.host, (s) => s.telephone?.laughs[authorId] === 2);
    expect(laughed.telephone?.laughs[authorId]).toBe(2);

    // Oda sahibi olmayan ilerletemez.
    players[1].emit('tp:next');
    await settle();
    expect((eventsOf(game.host, 'room:state').at(-1) as RoomState).telephone?.reveal).toMatchObject({ chain: 0, entry: 0 });

    // Oda sahibi tüm zincirleri gezer: 3 zincir × 3 adım.
    const ended = waitForState(game.host, (s) => s.phase === 'gameEnd');
    for (let i = 0; i < 9; i++) {
      game.host.emit('tp:next');
      await settle(30);
    }
    const end = await ended;
    expect(end.players.find((p) => p.id === authorId)?.score).toBe(2);
    expect(end.telephone).toBeNull();
  });

  it('süresi dolan adım boş kalmaz: öneri ve "…" ile doldurulur', async () => {
    // Bu test zamanlayıcıyı beklemek yerine oyuncuların yarısının ayrılmasını kullanır:
    // ayrılanların yerine adım sonunda yer tutucu yazılır ve oyun ilerler.
    const game = await setupRoom(ts, 2);
    const players = await startTelephone(game);
    const leaver = game.others[1].socket;
    leaver.disconnect();
    await settle();
    const next = [players[0], players[1]].map((c) => waitTask(c, 1));
    players[0].emit('tp:submit', 0, 'kedi');
    players[1].emit('tp:submit', 0, 'köpek');
    const tasks = await Promise.all(next);
    const texts = tasks.map((t) => (t.prompt as { text: string }).text);
    // Ayrılan oyuncunun zinciri de devam eder (önerilen metinle).
    expect(texts.every((t) => typeof t === 'string' && t.length > 0)).toBe(true);
  });
});

describe('Kırık Telefon güvenliği', () => {
  it('3 oyuncudan az ile başlamaz', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('room:settings', { mode: 'telephone' });
    await waitForState(game.host, (s) => s.settings.mode === 'telephone');
    game.host.emit('game:start');
    await settle();
    expect((eventsOf(game.host, 'room:state').at(-1) as RoomState).phase).toBe('lobby');
    expect(eventsOf(game.host, 'tp:task')).toHaveLength(0);
  });

  it('geçersiz mod ayarı yok sayılır', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('room:settings', { mode: 'admin' } as never);
    await settle();
    expect((eventsOf(game.host, 'room:state').at(-1) as RoomState).settings.mode).toBe('classic');
  });

  it('kimse başkasının zincirini önceden göremez; çizimler başkasına iletilmez', async () => {
    const game = await setupRoom(ts, 2);
    const players = await startTelephone(game);
    const next = players.map((c) => waitTask(c, 1));
    players.forEach((p, i) => {
      p.emit('tp:submit', 0, `gizli-yazi-${i}`);
    });
    await Promise.all(next);
    for (const op of stroke(5)) players[0].emit('tp:draw', 1, op as never);
    await settle();

    players.forEach((p, i) => {
      const seen = JSON.stringify(p.log);
      // Sunucudan her oyuncuya, başkalarının yazdıklarından sadece kendisine verilen tek metin gelir.
      const visible = [0, 1, 2].filter((j) => seen.includes(`gizli-yazi-${j}`));
      expect(visible).toEqual([chainIndexFor(i, 1, 3)]);
      expect(eventsOf(p, 'tp:reveal')).toHaveLength(0);
      if (i > 0) expect(eventsOf(p, 'draw:op')).toHaveLength(0);
    });
  });

  it('yanlış adıma, iki kez ya da zincir dışından gönderim kabul edilmez', async () => {
    const game = await setupRoom(ts, 2);
    const players = await startTelephone(game);

    players[0].emit('tp:submit', 5, 'gelecek adım');
    players[0].emit('tp:submit', 0, '');
    await settle();
    expect((eventsOf(game.host, 'room:state').at(-1) as RoomState).telephone?.submitted).toEqual([]);

    players[0].emit('tp:submit', 0, 'ilk');
    players[0].emit('tp:submit', 0, 'ikinci');
    await settle();
    const submitted = (eventsOf(game.host, 'room:state').at(-1) as RoomState).telephone?.submitted;
    expect(submitted).toEqual([game.hostId]);

    // Oyun başladıktan sonra gelen izleyici zincire katılamaz.
    const late = await connectClient(ts);
    const res = await join(late, payload('Geç Kalan', { code: game.code }));
    expect(res.ok).toBe(true);
    late.emit('tp:submit', 0, 'ben de');
    await settle();
    expect(eventsOf(late, 'tp:task')).toHaveLength(0);
    expect((eventsOf(game.host, 'room:state').at(-1) as RoomState).telephone?.submitted).toHaveLength(1);
  });

  it('yazma adımında çizim yapılamaz', async () => {
    const game = await setupRoom(ts, 2);
    const players = await startTelephone(game);
    for (const op of stroke(5)) players[1].emit('tp:draw', 0, op as never);
    await settle();
    // Reddedilen çizim için eşitleme gönderilmez (çizim adımı değil), oyun etkilenmez.
    expect((eventsOf(game.host, 'room:state').at(-1) as RoomState).telephone?.step).toBe(0);
  });
});
