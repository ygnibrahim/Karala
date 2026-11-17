// Bağlantı kopmaları: oyuncular kısa kopmalarda oyundan düşmemeli, kaldıkları yerden devam etmeli.
// Testlerde bekleme süreleri kısaltılmıştır (vitest.config.mts → RECONNECT_GRACE_MS=1500, DRAWER_GRACE_MS=800).
import type { ChatMessage, DrawItem, ImpostorRole, RoomState, TelephoneTask } from '@shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TIMING } from '../src/config';
import {
  type Client,
  eventsOf,
  type Game,
  reconnect,
  settle,
  setupRoom,
  startDrawing,
  startServer,
  type TestServer,
  waitFor,
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

/** Oyuncunun oturum anahtarını bulur. */
const sessionOf = (game: Game, socket: Client): string =>
  socket === game.host ? game.hostSession : (game.others.find((o) => o.socket === socket)?.sessionId ?? '');

describe('klasik mod: kopma ve geri dönme', () => {
  it('tahmin eden oyuncu kopup dönünce aynı kimlik, puan ve çizimle devam eder', async () => {
    const game = await setupRoom(ts, 2);
    const { drawer, guessers, word } = await startDrawing(game);
    const [winner, dropper] = guessers;

    // Biri puan alsın, çizen bir şey çizsin.
    winner.emit('chat:send', word);
    await waitFor(winner, 'word:secret');
    drawer.emit('draw:op', { t: 'start', color: '#000000', size: 5, x: 10, y: 10 });
    drawer.emit('draw:op', { t: 'move', pts: [20, 20, 40, 40] });
    await settle();

    const before = lastState(game.host);
    const dropperId = game.others.find((o) => o.socket === dropper)?.id ?? (dropper === game.host ? game.hostId : '');
    const scoreBefore = before.players.find((p) => p.id === dropperId)?.score;

    const back = await reconnect(ts, dropper, 'Dönen', sessionOf(game, dropper), game.code);
    expect(back.res).toMatchObject({ ok: true, playerId: dropperId });
    const history = (eventsOf(back.socket, 'draw:history').at(-1) as DrawItem[]) ?? [];
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ k: 'stroke', pts: [10, 10, 20, 20, 40, 40] });

    const after = lastState(back.socket);
    expect(after.phase).toBe('drawing');
    expect(after.players).toHaveLength(3);
    expect(after.players.find((p) => p.id === dropperId)).toMatchObject({ connected: true, score: scoreBefore });
  });

  it('tahta ekrana gelince istediği mevcut çizimi alır (sayfa yenileme sonrası)', async () => {
    const game = await setupRoom(ts, 1);
    const { drawer, guessers } = await startDrawing(game);
    drawer.emit('draw:op', { t: 'start', color: '#000000', size: 5, x: 3, y: 4 });
    drawer.emit('draw:op', { t: 'move', pts: [5, 6] });
    await settle();
    const viewer = guessers[0];
    const synced = waitFor<DrawItem[]>(viewer, 'draw:history', (h) => h.length === 1);
    viewer.emit('draw:sync');
    expect((await synced)[0]).toMatchObject({ k: 'stroke', pts: [3, 4, 5, 6] });
  });

  it('çizen kısa süre kopup dönerse tur bitmez ve kelimeyi yeniden alır', async () => {
    const game = await setupRoom(ts, 2);
    const { drawer, drawerId, word } = await startDrawing(game);
    const back = await reconnect(ts, drawer, 'Çizen', sessionOf(game, drawer), game.code);
    expect(back.res).toMatchObject({ ok: true, playerId: drawerId });
    expect(eventsOf(back.socket, 'word:secret').at(-1)).toBe(word);

    await settle(TIMING.drawerGraceMs + 300);
    const state = lastState(game.host);
    expect(state.phase).toBe('drawing');
    expect(state.drawerId).toBe(drawerId);
  });

  it('çizen geri dönmezse bekleme süresinden sonra tur biter', async () => {
    const game = await setupRoom(ts, 2);
    const { drawer } = await startDrawing(game);
    const watcher = game.host === drawer ? game.others[0].socket : game.host;
    drawer.disconnect();
    await settle(200);
    expect(lastState(watcher).phase).toBe('drawing'); // hemen bitmedi
    const ended = await waitForState(watcher, (s) => s.phase === 'turnEnd', TIMING.drawerGraceMs + 2000);
    expect(ended.turnResult?.reason).toBe('drawerLeft');
  });

  it('bekleme süresi dolunca oyuncu odadan çıkar, oda sahipliği devredilir', async () => {
    const game = await setupRoom(ts, 2);
    game.host.disconnect();
    const watcher = game.others[0].socket;
    const state = await waitForState(watcher, (s) => s.players.length === 2, TIMING.reconnectGraceMs + 2000);
    expect(state.players.some((p) => p.isHost)).toBe(true);
    expect(state.players.find((p) => p.isHost)?.id).not.toBe(game.hostId);
  });

  it('süre dolduktan sonra dönen oyuncu odaya yeniden katılabilir', async () => {
    const game = await setupRoom(ts, 2);
    const dropper = game.others[1];
    dropper.socket.disconnect();
    await waitForState(game.host, (s) => s.players.length === 2, TIMING.reconnectGraceMs + 2000);
    const back = await reconnect(ts, dropper.socket, 'Geç Dönen', dropper.sessionId, game.code);
    expect(back.res.ok).toBe(true);
    await settle();
    const state = lastState(game.host);
    expect(state.players).toHaveLength(3);
    expect(state.players.some((p) => p.name === 'Geç Dönen' && p.connected)).toBe(true);
  });

  it('kopma sırasında "geri döndü" mesajı ve doğru bağlantı durumu yayınlanır', async () => {
    const game = await setupRoom(ts, 1);
    const guest = game.others[0];
    guest.socket.disconnect();
    const offline = await waitForState(game.host, (s) => s.players.some((p) => p.id === guest.id && !p.connected));
    expect(offline.players).toHaveLength(2);
    const back = await reconnect(ts, guest.socket, 'Misafir', guest.sessionId, game.code);
    expect(back.res.ok).toBe(true);
    await settle();
    expect((eventsOf(game.host, 'chat:message') as ChatMessage[]).some((m) => m.text.includes('geri döndü'))).toBe(true);
    expect(lastState(game.host).players.find((p) => p.id === guest.id)?.connected).toBe(true);
  });
});

describe('Kırık Telefon: kopma ve geri dönme', () => {
  it('çizim adımında kopan oyuncu yarım çizimini ve görevini geri alır', async () => {
    const game = await setupRoom(ts, 2);
    game.host.emit('room:settings', { mode: 'telephone' });
    await waitForState(game.host, (s) => s.settings.mode === 'telephone');
    const everyone = [game.host, ...game.others.map((o) => o.socket)];
    const firstTasks = everyone.map((c) => waitFor<TelephoneTask>(c, 'tp:task', (t) => t.step === 0));
    game.host.emit('game:start');
    await Promise.all(firstTasks);
    const drawTasks = everyone.map((c) => waitFor<TelephoneTask>(c, 'tp:task', (t) => t.step === 1));
    everyone.forEach((c, i) => {
      c.emit('tp:submit', 0, `fikir ${i}`);
    });
    await Promise.all(drawTasks);

    const dropper = game.others[0];
    dropper.socket.emit('tp:draw', 1, { t: 'start', color: '#000000', size: 5, x: 1, y: 1 });
    dropper.socket.emit('tp:draw', 1, { t: 'move', pts: [5, 5] });
    await settle();
    // Diğerleri bitirse bile kopan oyuncu beklenir (süre dolana kadar).
    game.host.emit('tp:submit', 1);
    game.others[1].socket.emit('tp:submit', 1);

    const back = await reconnect(ts, dropper.socket, 'Dönen', dropper.sessionId, game.code);
    expect(back.res.ok).toBe(true);
    const task = eventsOf(back.socket, 'tp:task').at(-1) as TelephoneTask;
    expect(task).toMatchObject({ step: 1, kind: 'draw', submitted: false });
    const draft = eventsOf(back.socket, 'draw:history').at(-1) as DrawItem[];
    expect(draft[0]).toMatchObject({ k: 'stroke', pts: [1, 1, 5, 5] });
    expect(lastState(game.host).telephone?.step).toBe(1);
  });
});

describe('Sahtekâr: kopma ve geri dönme', () => {
  it('kopup dönen oyuncu rolünü (ve kelimeyi) yeniden alır', async () => {
    const game = await setupRoom(ts, 2);
    game.host.emit('room:settings', { mode: 'impostor' });
    await waitForState(game.host, (s) => s.settings.mode === 'impostor');
    const dropper = game.others[1];
    const firstRole = waitFor<ImpostorRole>(dropper.socket, 'imp:role');
    game.host.emit('game:start');
    const role = await firstRole;

    const back = await reconnect(ts, dropper.socket, 'Dönen', dropper.sessionId, game.code);
    expect(back.res.ok).toBe(true);
    expect(eventsOf(back.socket, 'imp:role').at(-1)).toEqual(role);
    expect(lastState(back.socket).phase).toBe('impostor');
  });

  it('kısa kopmada oylama beklenir; geri dönen oy verebilir', async () => {
    const game = await setupRoom(ts, 2);
    game.host.emit('room:settings', { mode: 'impostor' });
    await waitForState(game.host, (s) => s.settings.mode === 'impostor');
    game.host.emit('game:start');
    // Tüm sıraları pas geçip oylamaya gel.
    const all = [{ socket: game.host, id: game.hostId, sessionId: game.hostSession }, ...game.others.map((o) => ({ ...o }))];
    await waitForState(game.host, (s) => s.impostor?.stage === 'draw', 8000);
    for (let i = 0; i < 6; i++) {
      const st = lastState(game.host).impostor;
      if (st?.stage !== 'draw') break;
      const turn = all.find((p) => p.id === st.turnPlayerId);
      if (!turn) break;
      const next = waitForState(game.host, (x) => x.impostor?.stage !== 'draw' || x.impostor.turnPlayerId !== turn.id);
      turn.socket.emit('imp:done');
      await next;
    }
    expect(lastState(game.host).impostor?.stage).toBe('vote');

    const [a, b, dropper] = all;
    dropper.socket.disconnect();
    a.socket.emit('imp:vote', b.id);
    b.socket.emit('imp:vote', a.id);
    await settle(300);
    // Kopan oyuncu henüz oy vermedi: oylama bitmedi.
    expect(lastState(a.socket).impostor?.stage).toBe('vote');

    const back = await reconnect(ts, dropper.socket, 'Dönen', dropper.sessionId, game.code);
    expect(back.res.ok).toBe(true);
    const done = waitForState(a.socket, (s) => s.impostor?.stage !== 'vote');
    back.socket.emit('imp:vote', a.id);
    const after = await done;
    expect(['guess', 'result']).toContain(after.impostor?.stage);
  }, 20_000);
});
