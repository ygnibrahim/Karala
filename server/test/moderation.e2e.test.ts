// Moderasyon: küfür filtresinin devrede olması ve oda sahibinin oyuncu atabilmesi.
import type { ChatMessage, RoomState } from '@shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WORDS } from '../src/game/wordList';
import { containsProfanity } from '../src/moderation/profanity';
import {
  type Client,
  connectClient,
  eventsOf,
  join,
  payload,
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

describe('küfür filtresi devrede', () => {
  it('kelime havuzundaki hiçbir kelime filtreye takılmaz (yanlış alarm yok)', () => {
    expect(WORDS.karisik.filter(containsProfanity)).toEqual([]);
  });

  it('sohbetteki küfür diğerlerine yıldızlı gider', async () => {
    const game = await setupRoom(ts, 1);
    const guest = game.others[0].socket;
    game.host.emit('chat:send', 'selam amk nasılsın');
    const msg = await waitFor<ChatMessage>(guest, 'chat:message', (m) => m.kind === 'chat');
    expect(msg.text).toBe('selam *** nasılsın');
  });

  it('küfürlü isim "Oyuncu" olarak görünür', async () => {
    const game = await setupRoom(ts, 0);
    const c = await connectClient(ts);
    await join(c, payload('0r0spu', { code: game.code }));
    await settle();
    expect(lastState(game.host).players.map((p) => p.name)).toEqual(['Ev Sahibi', 'Oyuncu']);
  });

  it('küfürlü özel kelimeler listeye alınmaz', async () => {
    const game = await setupRoom(ts, 0);
    const words = waitFor<string[]>(game.host, 'room:customWords', (w) => w.length > 0);
    game.host.emit('room:settings', { customWords: ['kedi', 'siktir', 'uçan halı'] });
    expect(await words).toEqual(['kedi', 'uçan halı']);
  });
});

describe('oyuncu atma', () => {
  it('oda sahibi atar: atılan haber alır, listeden çıkar, yayın almaz ve geri giremez', async () => {
    const game = await setupRoom(ts, 2);
    const [target, other] = game.others;
    const kicked = waitFor(target.socket, 'room:kicked');
    game.host.emit('room:kick', target.id);
    await kicked;
    await settle();
    expect(lastState(game.host).players.map((p) => p.id)).not.toContain(target.id);
    expect((eventsOf(other.socket, 'chat:message') as ChatMessage[]).some((m) => m.text.includes('çıkarıldı'))).toBe(true);

    // Atılan, odadaki konuşmaları artık duymaz.
    target.socket.log.length = 0;
    game.host.emit('chat:send', 'atılan duymasın');
    await waitFor(other.socket, 'chat:message', (m: ChatMessage) => m.text === 'atılan duymasın');
    await settle();
    expect(eventsOf(target.socket, 'chat:message')).toHaveLength(0);

    // Aynı oturumla geri giremez; eski bağlantısından işlem de yapamaz.
    target.socket.emit('chat:send', 'hâlâ buradayım');
    const back = await reconnect(ts, target.socket, 'Geri', target.sessionId, game.code);
    expect(back.res).toEqual({ ok: false, error: 'Bu odadan çıkarıldın.' });
    await settle();
    expect((eventsOf(game.host, 'chat:message') as ChatMessage[]).some((m) => m.text === 'hâlâ buradayım')).toBe(false);
  });

  it('oda sahibi olmayan kimseyi atamaz; oda sahibi kendini atamaz', async () => {
    const game = await setupRoom(ts, 2);
    const [a, b] = game.others;
    a.socket.emit('room:kick', b.id);
    a.socket.emit('room:kick', game.hostId);
    game.host.emit('room:kick', game.hostId);
    await settle();
    expect(lastState(game.host).players).toHaveLength(3);
  });

  it('oyun sırasında çizeni atınca tur biter, oyun devam eder', async () => {
    const game = await setupRoom(ts, 2);
    // İlk çizen oda sahibidir: herkes bilsin, ikinci tura geçilsin (çizen artık başkası).
    const first = await startDrawing(game);
    const nextTurn = waitForState(game.host, (s) => s.phase === 'choosing' && s.drawerId !== first.drawerId, 10_000);
    for (const g of first.guessers) g.emit('chat:send', first.word);
    const second = await nextTurn;
    expect(second.drawerId).not.toBe(game.hostId);

    const ended = waitForState(game.host, (s) => s.phase === 'turnEnd');
    game.host.emit('room:kick', second.drawerId as string);
    expect((await ended).turnResult?.reason).toBe('drawerLeft');
    expect(lastState(game.host).players).toHaveLength(2);
  }, 20_000);
});
