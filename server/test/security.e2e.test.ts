// Uçtan uca güvenlik testleri: gerçek sunucu + gerçek socket bağlantıları.
// Her test, kötü niyetli ya da hileci bir oyuncunun yapabileceği bir şeyi dener.
import type { ChatMessage, DrawOp, RoomState } from '@shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IP_RATE_LIMITS, RATE_LIMITS } from '../src/config';
import {
  connectClient,
  create,
  eventsOf,
  join,
  newSessionId,
  payload,
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

const lastState = (events: unknown[]) => events.at(-1) as RoomState;

describe('kimlik ve oturum', () => {
  it('gizli oturum anahtarı hiçbir yayında yer almaz', async () => {
    const host = await connectClient(ts);
    const hostPayload = payload('Ayşe');
    const created = await create(host, hostPayload);
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const guest = await connectClient(ts);
    const guestPayload = payload('Can', { code: created.code });
    await join(guest, guestPayload);
    await settle();

    const everything = JSON.stringify(guest.log);
    expect(everything).not.toContain(hostPayload.sessionId);
    expect(created.playerId).not.toBe(hostPayload.sessionId);
  });

  it('başkasının herkese açık kimliğiyle onun yerine geçilemez', async () => {
    const game = await setupRoom(ts, 1);
    const attacker = await connectClient(ts);
    // Saldırgan, yayınlarda gördüğü oda sahibi kimliğini oturum anahtarı gibi kullanmayı dener.
    const res = await join(attacker, payload('Sahte', { code: game.code, sessionId: game.hostId.padEnd(16, '_') }));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.playerId).not.toBe(game.hostId);

    await settle();
    const state = lastState(eventsOf(game.host, 'room:state'));
    expect(state.players).toHaveLength(3);
    expect(state.players.find((p) => p.id === game.hostId)?.name).toBe('Ev Sahibi');
  });

  it('aynı oturumla yeni bağlantı gelince eski bağlantı oda yayınlarını almaz', async () => {
    const game = await setupRoom(ts, 1);
    const sessionId = newSessionId();
    const first = await connectClient(ts);
    const firstJoin = await join(first, payload('Mert', { code: game.code, sessionId }));
    const second = await connectClient(ts);
    const secondJoin = await join(second, payload('Mert', { code: game.code, sessionId }));
    expect(firstJoin.ok && secondJoin.ok && firstJoin.playerId === secondJoin.playerId).toBe(true);

    await settle();
    first.log.length = 0;
    game.host.emit('chat:send', 'herkese merhaba');
    await waitFor(second, 'chat:message', (m: ChatMessage) => m.text === 'herkese merhaba');
    await settle();
    expect(eventsOf(first, 'chat:message')).toHaveLength(0);
  });

  it('geçersiz katılma istekleri reddedilir', async () => {
    const game = await setupRoom(ts, 0);
    const c = await connectClient(ts);
    expect(await join(c, payload('x', { code: 'ZZZZZ' }))).toEqual({ ok: false, error: 'notFound' });
    expect(await join(c, payload('x', { code: game.code, sessionId: 'kisa' }))).toEqual({ ok: false, error: 'invalid' });
    expect(await join(c, payload('x', { code: '../../' }))).toMatchObject({ ok: false });
  });

  it('oda dolunca yeni oyuncu giremez', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('room:settings', { maxPlayers: 2 });
    await settle();
    const c = await connectClient(ts);
    expect(await join(c, payload('Üçüncü', { code: game.code }))).toEqual({ ok: false, error: 'full' });
  });
});

describe('bağlantı ve oda değişimi', () => {
  it('aynı oturum başka sekmede açılınca eski sekme oyuncu adına işlem yapamaz', async () => {
    const game = await setupRoom(ts, 0);
    const sessionId = newSessionId();
    const oldTab = await connectClient(ts);
    await join(oldTab, payload('Mert', { code: game.code, sessionId }));
    const newTab = await connectClient(ts);
    await join(newTab, payload('Mert', { code: game.code, sessionId }));
    await settle();

    oldTab.emit('chat:send', 'eski sekmeden mesaj');
    oldTab.emit('room:leave');
    newTab.emit('chat:send', 'yeni sekmeden mesaj');
    await waitFor(game.host, 'chat:message', (m: ChatMessage) => m.text === 'yeni sekmeden mesaj');
    await settle();
    const texts = (eventsOf(game.host, 'chat:message') as ChatMessage[]).map((m) => m.text);
    expect(texts).not.toContain('eski sekmeden mesaj');
    // Eski sekmenin "ayrıl" isteği, güncel bağlantıyı odadan atmamalı.
    expect(lastState(eventsOf(game.host, 'room:state')).players).toHaveLength(2);
  });

  it('dolu odaya giremeyen oyuncu kendi odasından çıkarılmaz', async () => {
    const roomA = await setupRoom(ts, 1);
    const roomB = await setupRoom(ts, 1);
    roomB.host.emit('room:settings', { maxPlayers: 2 });
    await settle();

    const wanderer = roomA.others[0];
    const res = await join(wanderer.socket, payload('Gezgin', { code: roomB.code }));
    expect(res).toEqual({ ok: false, error: 'full' });
    await settle();
    expect(lastState(eventsOf(roomA.host, 'room:state')).players.map((p) => p.id)).toContain(wanderer.id);

    roomA.host.emit('chat:send', 'hâlâ buradasın');
    await waitFor(wanderer.socket, 'chat:message', (m: ChatMessage) => m.text === 'hâlâ buradasın');
  });
});

describe('kelime gizliliği (hile önleme)', () => {
  it('tahmin edenler kelimeyi ve seçenekleri hiçbir şekilde almaz', async () => {
    const game = await setupRoom(ts, 2);
    const { guessers, word } = await startDrawing(game);
    await settle();
    for (const g of guessers) {
      expect(eventsOf(g, 'word:choices')).toHaveLength(0);
      expect(eventsOf(g, 'word:secret')).toHaveLength(0);
      // Kelime, ham olarak hiçbir olayda geçmemeli (maske hariç).
      expect(JSON.stringify(g.log)).not.toContain(`"${word}"`);
      const hint = lastState(eventsOf(g, 'room:state')).hint;
      expect(hint?.every((c) => c === '_' || c === ' ')).toBe(true);
    }
  });

  it('kelimeyi bilen oyuncu kelimeyi alır, diğerleri almaz', async () => {
    const game = await setupRoom(ts, 2);
    const { guessers, word } = await startDrawing(game);
    const [winner, other] = guessers;
    const secret = waitFor<string>(winner, 'word:secret');
    winner.emit('chat:send', word.toUpperCase());
    expect(await secret).toBe(word);
    await settle();
    expect(eventsOf(other, 'word:secret')).toHaveLength(0);
    // Doğru tahmin mesajı kelimeyi içermez.
    const msgs = eventsOf(other, 'chat:message') as ChatMessage[];
    expect(msgs.some((m) => m.kind === 'correct')).toBe(true);
    expect(msgs.some((m) => m.text.toLocaleLowerCase('tr').includes(word))).toBe(false);
  });

  it('bilen ve çizen oyuncuların sohbeti bilmeyenlere gitmez', async () => {
    const game = await setupRoom(ts, 2);
    const { drawer, guessers, word } = await startDrawing(game);
    const [winner, other] = guessers;
    winner.emit('chat:send', word);
    await waitFor(winner, 'word:secret');

    winner.emit('chat:send', 'ipucu: başı k ile başlıyor');
    drawer.emit('chat:send', 'çizenden gizli not');
    await waitFor(drawer, 'chat:message', (m: ChatMessage) => m.text === 'ipucu: başı k ile başlıyor');
    await settle();
    const seen = (eventsOf(other, 'chat:message') as ChatMessage[]).map((m) => m.text);
    expect(seen).not.toContain('ipucu: başı k ile başlıyor');
    expect(seen).not.toContain('çizenden gizli not');
  });

  it('çizen kendi kelimesini tahmin ederek puan alamaz', async () => {
    const game = await setupRoom(ts, 1);
    const { drawer, drawerId, word } = await startDrawing(game);
    drawer.emit('chat:send', word);
    await settle();
    const state = lastState(eventsOf(drawer, 'room:state'));
    expect(state.players.find((p) => p.id === drawerId)?.score).toBe(0);
    expect(state.phase).toBe('drawing');
  });

  it('özel kelimeler sadece oda sahibine gönderilir', async () => {
    const game = await setupRoom(ts, 1);
    const guest = game.others[0].socket;
    const hostWords = waitFor<string[]>(game.host, 'room:customWords', (w) => w.length === 3);
    game.host.emit('room:settings', { customWords: ['gizli bir', 'gizli iki', 'gizli üç'] });
    expect(await hostWords).toEqual(['gizli bir', 'gizli iki', 'gizli üç']);

    const state = await waitForState(guest, (s) => s.settings.customWordCount === 3);
    expect(state.settings).not.toHaveProperty('customWords');
    expect(JSON.stringify(guest.log)).not.toContain('gizli');
  });
});

describe('yetki kontrolleri', () => {
  it('oda sahibi olmayan ayarları değiştiremez ve oyunu başlatamaz', async () => {
    const game = await setupRoom(ts, 1);
    const guest = game.others[0].socket;
    guest.emit('room:settings', { rounds: 10 });
    guest.emit('game:start');
    await settle();
    const state = lastState(eventsOf(game.host, 'room:state'));
    expect(state.settings.rounds).toBe(3);
    expect(state.phase).toBe('lobby');
  });

  it('sadece çizen çizebilir; diğerlerinin çizimi kimseye iletilmez', async () => {
    const game = await setupRoom(ts, 2);
    const { drawer, guessers } = await startDrawing(game);
    const [cheater, watcher] = guessers;
    cheater.emit('draw:op', { t: 'start', color: '#ff0000', size: 10, x: 5, y: 5 });
    cheater.emit('draw:op', { t: 'clear' });
    await settle();
    expect(eventsOf(drawer, 'draw:op')).toHaveLength(0);
    expect(eventsOf(watcher, 'draw:op')).toHaveLength(0);
  });

  it('çizenin geçersiz çizimleri atılır, geçerliler temizlenerek iletilir', async () => {
    const game = await setupRoom(ts, 1);
    const { drawer, guessers } = await startDrawing(game);
    const watcher = guessers[0];
    drawer.emit('draw:op', { t: 'start', color: 'javascript:alert(1)', size: 10, x: 5, y: 5 } as unknown as DrawOp);
    drawer.emit('draw:op', { t: 'start', color: '#00FF00', size: 10, x: 5, y: 5, evil: '<script>' } as unknown as DrawOp);
    const op = await waitFor<DrawOp>(watcher, 'draw:op');
    expect(op).toEqual({ t: 'start', color: '#00ff00', size: 10, x: 5, y: 5 });
    await settle();
    expect(eventsOf(watcher, 'draw:op')).toHaveLength(1);
  });

  it('lobi aşamasında kimse çizemez', async () => {
    const game = await setupRoom(ts, 1);
    game.host.emit('draw:op', { t: 'start', color: '#000000', size: 5, x: 1, y: 1 });
    await settle();
    expect(eventsOf(game.others[0].socket, 'draw:op')).toHaveLength(0);
  });
});

describe('istek sınırlama ve kaynak koruması', () => {
  it('sohbet bombardımanı kapasiteyle sınırlanır', async () => {
    const game = await setupRoom(ts, 1);
    const spammer = game.others[0].socket;
    for (let i = 0; i < 50; i++) spammer.emit('chat:send', `spam ${i}`);
    await settle(400);
    const received = (eventsOf(game.host, 'chat:message') as ChatMessage[]).filter((m) => m.text.startsWith('spam'));
    expect(received.length).toBeLessThanOrEqual(RATE_LIMITS.chat.capacity + 1);
    expect(received.length).toBeGreaterThan(0);
  });

  it('boya kovası bombardımanı sınırlanır (diğer oyuncuların cihazını kasmasın)', async () => {
    const game = await setupRoom(ts, 1);
    const { drawer, guessers } = await startDrawing(game);
    for (let i = 0; i < 30; i++) drawer.emit('draw:op', { t: 'fill', color: '#123456', x: i, y: i });
    await settle(400);
    const fills = (eventsOf(guessers[0], 'draw:op') as DrawOp[]).filter((op) => op.t === 'fill');
    expect(fills.length).toBeLessThanOrEqual(RATE_LIMITS.fill.capacity + 1);
  });

  it('oda kurma bombardımanı sınırlanır', async () => {
    const c = await connectClient(ts);
    const results = [];
    for (let i = 0; i < 10; i++) results.push(await create(c, payload('Spam')));
    expect(results.filter((r) => r.ok).length).toBeLessThanOrEqual(RATE_LIMITS.room.capacity);
    // Bir socket aynı anda tek odada olabilir: eski odalar boşalınca silinir.
    expect(ts.server.rooms.size).toBe(1);
  });

  it('aynı IP adresinden çok sayıda bağlantıyla oda yağdırılamaz', async () => {
    const results = [];
    for (let i = 0; i < IP_RATE_LIMITS.room.capacity + 3; i++) {
      const c = await connectClient(ts);
      results.push(await create(c, payload(`Bot${i}`)));
    }
    const ok = results.filter((r) => r.ok).length;
    expect(ok).toBeLessThanOrEqual(IP_RATE_LIMITS.room.capacity + 1);
    expect(results.at(-1)).toMatchObject({ ok: false });
  });

  it('reddedilen çizimden sonra çizenin ekranı sunucudaki geçmişle eşitlenir', async () => {
    const game = await setupRoom(ts, 1);
    const { drawer } = await startDrawing(game);
    drawer.log.length = 0;
    for (let i = 0; i < 10; i++) drawer.emit('draw:op', { t: 'fill', color: '#123456', x: i, y: i });
    await waitFor(drawer, 'draw:history');
  });

  it('çok büyük mesaj gönderen bağlantı kesilir', async () => {
    const c = await connectClient(ts);
    const closed = new Promise((resolve) => c.once('disconnect', resolve));
    c.emit('chat:send', 'x'.repeat(200 * 1024));
    await expect(closed).resolves.toBeDefined();
  });

  it('bozuk tipte olaylar sunucuyu çökertmez', async () => {
    const game = await setupRoom(ts, 1);
    const bad = game.others[0].socket as unknown as { emit: (...a: unknown[]) => void };
    bad.emit('chat:send', { toString: 'x' });
    bad.emit('word:choose', '0; DROP TABLE');
    bad.emit('react', '<img src=x>');
    bad.emit('room:settings', null);
    bad.emit('draw:op', 'çiz');
    bad.emit('room:join', null, () => {});
    await settle();
    const health = await fetch(`${ts.url}/health`).then((r) => r.json());
    expect(health.ok).toBe(true);
  });
});

describe('HTTP güvenlik başlıkları', () => {
  it('güvenlik başlıklarını gönderir ve sunucu bilgisini gizler', async () => {
    const res = await fetch(`${ts.url}/health`);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-powered-by')).toBeNull();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    // Üçüncü taraf kaynak yok (yazı tipi dahil): oyuncuların IP'si başka bir siteye gitmez.
    expect(csp).not.toContain('http://');
    expect(csp).not.toContain('https://');
  });
});
