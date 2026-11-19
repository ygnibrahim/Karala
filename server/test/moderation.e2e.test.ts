// Moderasyon: küfür filtresinin devrede olması ve oda sahibinin oyuncu atabilmesi.
import type { ChatMessage, RoomState } from '@shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
    expect((eventsOf(other.socket, 'chat:message') as ChatMessage[]).some((m) => m.key === 'kicked')).toBe(true);

    // Atılan, odadaki konuşmaları artık duymaz.
    target.socket.log.length = 0;
    game.host.emit('chat:send', 'atılan duymasın');
    await waitFor(other.socket, 'chat:message', (m: ChatMessage) => m.text === 'atılan duymasın');
    await settle();
    expect(eventsOf(target.socket, 'chat:message')).toHaveLength(0);

    // Aynı oturumla geri giremez; eski bağlantısından işlem de yapamaz.
    target.socket.emit('chat:send', 'hâlâ buradayım');
    const back = await reconnect(ts, target.socket, 'Geri', target.sessionId, game.code);
    expect(back.res).toEqual({ ok: false, error: 'banned' });
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

describe('oyuncu bildirme', () => {
  let reports: Record<string, unknown>[];
  let warnSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    reports = [];
    warnSpy = vi.spyOn(console, 'warn').mockImplementation((line: unknown) => {
      if (typeof line === 'string' && line.includes('player-report')) reports.push(JSON.parse(line));
    });
  });
  afterEach(() => warnSpy.mockRestore());

  it('bildirim kaydedilir, son mesajları içerir, gizli bilgi içermez; bildirene teşekkür gider', async () => {
    const game = await setupRoom(ts, 3);
    const bad = game.others[0];
    bad.socket.emit('chat:send', 'birinci mesaj');
    bad.socket.emit('chat:send', 'ikinci mesaj');
    await settle();
    game.others[1].socket.emit('player:report', bad.id, 'abuse');
    await waitFor<ChatMessage>(game.others[1].socket, 'chat:message', (m) => m.key === 'reportThanks');
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ reason: 'abuse', reportCount: 1, autoKicked: false, target: { id: bad.id } });
    expect(reports[0].recentMessages).toEqual(['birinci mesaj', 'ikinci mesaj']);
    const line = JSON.stringify(reports[0]);
    expect(line).not.toContain(bad.sessionId);
    expect(line).not.toContain(game.others[1].sessionId);
    // Bildirilen kişi ve diğerleri bildirimden haberdar olmaz.
    expect(eventsOf(bad.socket, 'chat:message').some((m) => (m as ChatMessage).key === 'reportThanks')).toBe(false);
    expect(eventsOf(game.host, 'chat:message').some((m) => (m as ChatMessage).key === 'reportThanks')).toBe(false);
  });

  it('aynı kişi bir oyuncuyu bir kez bildirebilir; kendini ve geçersiz sebebi bildiremez', async () => {
    const game = await setupRoom(ts, 3);
    const target = game.others[0].id;
    const reporter = game.others[1].socket;
    reporter.emit('player:report', target, 'spam');
    reporter.emit('player:report', target, 'spam');
    await waitFor<ChatMessage>(reporter, 'chat:message', (m) => m.key === 'alreadyReported');
    reporter.emit('player:report', game.others[1].id, 'spam');
    reporter.emit('player:report', target, 'hacker' as never);
    reporter.emit('player:report', 'olmayan-kimlik', 'spam');
    await settle();
    expect(reports).toHaveLength(1);
  });

  it('diğer oyuncuların yarısı bildirirse oyuncu odadan çıkarılır ve geri giremez', async () => {
    const game = await setupRoom(ts, 4); // 5 kişi: bildirilen hariç 4 kişinin yarısı = 2 bildirim
    const bad = game.others[0];
    game.others[1].socket.emit('player:report', bad.id, 'abuse');
    await settle();
    expect(lastState(game.host).players).toHaveLength(5);
    const kicked = waitFor(bad.socket, 'room:kicked');
    game.others[2].socket.emit('player:report', bad.id, 'drawing');
    await kicked;
    await waitForState(game.host, (s) => s.players.length === 4 && !s.players.some((p) => p.id === bad.id));
    expect(reports.at(-1)).toMatchObject({ reportCount: 2, autoKicked: true });
    expect(eventsOf(game.host, 'chat:message').some((m) => (m as ChatMessage).key === 'autoKicked')).toBe(true);

    const back = await reconnect(ts, bad.socket, 'Oyuncu1', bad.sessionId, game.code);
    expect(back.res.ok).toBe(false);
  });

  it('iki kişilik odada tek bildirim kimseyi atmaz', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('player:report', game.others[0].id, 'abuse');
    await settle(200);
    expect(lastState(game.host).players).toHaveLength(2);
    expect(reports[0]).toMatchObject({ autoKicked: false });
  });

  it('sohbet mesajında yazanın kimliği vardır (sessize alma için)', async () => {
    const game = await setupRoom(ts, 1);
    game.others[0].socket.emit('chat:send', 'merhaba');
    const m = await waitFor<ChatMessage>(game.host, 'chat:message', (x) => x.text === 'merhaba');
    expect(m.from).toBe(game.others[0].id);
  });
});
