// Çizim Yarışı (takım modu): takım seçimi, çizimin ve sohbetin sadece kendi takımına gitmesi,
// ilk bilen takımın turu alması, kopma/ayrılma durumları ve oyun sonu.
// Süreler testlerde kısaltılmıştır (vitest.config.mts → TEAM_INTRO_MS, TEAM_RESULT_MS).
import type { ChatMessage, DrawOp, GalleryItem, RoomState, TeamId } from '@shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TEAM_SCORING } from '../src/config';
import {
  type Client,
  eventsOf,
  type Game,
  nextEvent,
  reconnect,
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
const stroke: DrawOp[] = [
  { t: 'start', color: '#000000', size: 6, x: 10, y: 10 },
  { t: 'move', pts: [20, 20, 30, 30] },
];

interface Member {
  socket: Client;
  id: string;
  sessionId: string;
  name: string;
}

const membersOf = (game: Game): Member[] => [
  { socket: game.host, id: game.hostId, sessionId: game.hostSession, name: 'Ev Sahibi' },
  ...game.others.map((o, i) => ({ ...o, name: `Oyuncu${i + 1}` })),
];

/** 4 kişilik oda kurar, takım modunu seçer. Katılma sırasıyla takımlar: kırmızı, mavi, kırmızı, mavi. */
async function teamsRoom(extra = 3, rounds = 2) {
  const game = await setupRoom(ts, extra);
  game.host.emit('room:settings', { mode: 'teams', rounds });
  await waitForState(game.host, (s) => s.settings.mode === 'teams' && s.settings.rounds === rounds);
  return { game, all: membersOf(game) };
}

/** Oyunu başlatır ve çizim aşamasını bekler. Her takımın çizenini ve tahmin edenlerini döner. */
async function startRace(game: Game, all: Member[]) {
  const from = game.host.log.length;
  game.host.emit('game:start');
  const drawing = await nextEvent<RoomState>(game.host, 'room:state', (s) => s.teams?.race?.stage === 'draw', from, 3000);
  const teams = drawing.teams;
  if (!teams?.race) throw new Error('yarış başlamadı');
  const teamOf = (id: string) => teams.members[id];
  const side = (team: TeamId) => {
    const drawerId = teams.race?.drawers[team];
    const drawer = all.find((m) => m.id === drawerId);
    if (!drawer) throw new Error(`${team} çizeni yok`);
    return { drawer, guessers: all.filter((m) => teamOf(m.id) === team && m.id !== drawerId) };
  };
  return { state: drawing, red: side('red'), blue: side('blue'), teamOf };
}

describe('Çizim Yarışı: lobi ve takım seçimi', () => {
  it('oyuncular sırayla iki takıma dağılır; takım değiştirilebilir, oda sahibi karıştırabilir', async () => {
    const { game, all } = await teamsRoom();
    const members = lastState(game.host).teams?.members ?? {};
    expect(all.map((m) => members[m.id])).toEqual(['red', 'blue', 'red', 'blue']);

    // Oyuncu kendi takımını değiştirir.
    all[1].socket.emit('team:join', 'red');
    await waitForState(game.host, (s) => s.teams?.members[all[1].id] === 'red');
    // Geçersiz takım yok sayılır.
    all[1].socket.emit('team:join', 'yesil' as TeamId);
    await settle();
    expect(lastState(game.host).teams?.members[all[1].id]).toBe('red');

    // Sadece oda sahibi karıştırabilir; karıştırınca takımlar 2-2 olur.
    const before = game.host.log.length;
    all[1].socket.emit('team:shuffle');
    await settle();
    expect(
      eventsOf(game.host, 'chat:message')
        .slice(0)
        .some((m) => (m as ChatMessage).key === 'teamsShuffled'),
    ).toBe(false);
    game.host.emit('team:shuffle');
    const shuffled = await nextEvent<RoomState>(
      game.host,
      'room:state',
      (s) => Object.values(s.teams?.members ?? {}).filter((t) => t === 'red').length === 2,
      before,
    );
    expect(Object.values(shuffled.teams?.members ?? {}).filter((t) => t === 'blue')).toHaveLength(2);
  });

  it('başka modlarda takım bilgisi yayınlanmaz', async () => {
    const game = await setupRoom(ts, 1);
    expect(lastState(game.host).teams).toBeNull();
  });

  it('her takımda en az 2 kişi yoksa oyun başlamaz', async () => {
    const { game, all } = await teamsRoom();
    all[3].socket.emit('team:join', 'red'); // 3 kırmızı, 1 mavi
    await waitForState(game.host, (s) => s.teams?.members[all[3].id] === 'red');
    game.host.emit('game:start');
    await settle(200);
    expect(lastState(game.host).phase).toBe('lobby');
    expect(eventsOf(game.host, 'chat:message').some((m) => (m as ChatMessage).key === 'teamsNeedPlayers')).toBe(true);
  });
});

describe('Çizim Yarışı: tur', () => {
  it('iki çizen aynı kelimeyi alır; tahmin edenler kelimeyi görmez', async () => {
    const { game, all } = await teamsRoom();
    const { red, blue } = await startRace(game, all);
    const redWord = eventsOf(red.drawer.socket, 'word:secret').at(-1);
    const blueWord = eventsOf(blue.drawer.socket, 'word:secret').at(-1);
    expect(redWord).toBeTruthy();
    expect(blueWord).toBe(redWord);
    for (const g of [...red.guessers, ...blue.guessers]) expect(eventsOf(g.socket, 'word:secret')).toHaveLength(0);
    // Herkese giden durumda kelime yok, sadece maskeli ipucu var.
    const seen = await nextEvent<RoomState>(red.guessers[0].socket, 'room:state', (s) => s.teams?.race?.stage === 'draw');
    expect(JSON.stringify(seen)).not.toContain(`"${redWord}"`);
    expect(seen.hint?.length).toBe((redWord as string).length);
  });

  it('çizim sadece çizenin takımına gider; rakip ve tahmin edenler çizemez', async () => {
    const { game, all } = await teamsRoom();
    const { red, blue } = await startRace(game, all);
    const blueFrom = blue.guessers[0].socket.log.length;
    for (const op of stroke) red.drawer.socket.emit('draw:op', op);
    await nextEvent(red.guessers[0].socket, 'draw:op', (op: DrawOp) => op.t === 'move');
    await settle();
    expect(blue.guessers[0].socket.log.slice(blueFrom).some((e) => e.event === 'draw:op')).toBe(false);
    expect(blue.drawer.socket.log.some((e) => e.event === 'draw:op')).toBe(false);

    // Tahmin eden çizemez.
    const redFrom = red.drawer.socket.log.length;
    red.guessers[0].socket.emit('draw:op', stroke[0]);
    await settle();
    expect(red.drawer.socket.log.slice(redFrom).some((e) => e.event === 'draw:op')).toBe(false);
  });

  it('sohbet sadece kendi takımına gider; çizen kelimeyi yazamaz', async () => {
    const { game, all } = await teamsRoom();
    const { red, blue } = await startRace(game, all);
    const word = eventsOf(red.drawer.socket, 'word:secret').at(-1) as string;

    red.guessers[0].socket.emit('chat:send', 'bu bir uçak mı');
    await nextEvent<ChatMessage>(red.drawer.socket, 'chat:message', (m) => m.text === 'bu bir uçak mı');
    await settle();
    for (const m of [blue.drawer, ...blue.guessers]) {
      expect(eventsOf(m.socket, 'chat:message').some((x) => (x as ChatMessage).text === 'bu bir uçak mı')).toBe(false);
    }

    red.drawer.socket.emit('chat:send', `ipucu: ${word}`);
    await nextEvent<ChatMessage>(red.drawer.socket, 'chat:message', (m) => m.kind === 'close' && m.key === 'drawerNoWord');
    await settle();
    expect(eventsOf(red.guessers[0].socket, 'chat:message').some((x) => (x as ChatMessage).text.includes(word))).toBe(false);
  });

  it('ilk bilen takım turu alır; tur sonunda iki çizim de herkese gösterilir', async () => {
    const { game, all } = await teamsRoom();
    const { red, blue } = await startRace(game, all);
    const word = eventsOf(red.drawer.socket, 'word:secret').at(-1) as string;
    for (const op of stroke) red.drawer.socket.emit('draw:op', op);
    await nextEvent(red.guessers[0].socket, 'draw:op', (op: DrawOp) => op.t === 'move');

    const from = game.host.log.length;
    blue.guessers[0].socket.emit('chat:send', word.toLocaleUpperCase('tr'));
    const result = await nextEvent<RoomState>(game.host, 'room:state', (s) => s.teams?.race?.stage === 'result', from);
    const r = result.teams?.race?.result;
    expect(r?.winner).toBe('blue');
    expect(r?.word).toBe(word);
    expect(r?.guesserId).toBe(blue.guessers[0].id);
    expect(r?.drawings.red.length).toBe(1); // kırmızının çizimi artık maviler tarafından da görülür
    expect(result.teams?.score).toEqual({ red: 0, blue: TEAM_SCORING.win });
    const score = (id: string) => result.players.find((p) => p.id === id)?.score;
    expect(score(blue.guessers[0].id)).toBe(TEAM_SCORING.guesser);
    expect(score(blue.drawer.id)).toBe(TEAM_SCORING.drawer);
    expect(score(red.drawer.id)).toBe(0);

    // Tur bitince ikinci bilen puan almaz (tur kapandı).
    red.guessers[0].socket.emit('chat:send', word);
    await settle();
    expect(lastState(game.host).teams?.score.red).toBe(0);
  });

  it('sonraki turda takımda sıradaki kişi çizer ve tuvaller temizlenir', async () => {
    const { game, all } = await teamsRoom();
    const { red, blue } = await startRace(game, all);
    const word = eventsOf(red.drawer.socket, 'word:secret').at(-1) as string;
    for (const op of stroke) red.drawer.socket.emit('draw:op', op);
    const from = game.host.log.length;
    red.guessers[0].socket.emit('chat:send', word);
    const turn2 = await nextEvent<RoomState>(
      game.host,
      'room:state',
      (s) => s.teams?.race?.turn === 2 && s.teams.race.stage === 'draw',
      from,
    );
    expect(turn2.teams?.race?.drawers.red).toBe(red.guessers[0].id);
    expect(turn2.teams?.race?.drawers.blue).toBe(blue.guessers[0].id);
    expect(eventsOf(red.drawer.socket, 'draw:history').at(-1)).toEqual([]);
    // Yeni çizenler yeni kelimeyi aldı.
    const word2 = eventsOf(red.guessers[0].socket, 'word:secret').at(-1);
    expect(word2).toBeTruthy();
    expect(word2).not.toBe(word);
  });
});

describe('Çizim Yarışı: kopma, ayrılma ve oyun sonu', () => {
  it('sayfayı yenileyen çizen kelimeyi ve kendi takımının çizimini geri alır', async () => {
    const { game, all } = await teamsRoom();
    const { red } = await startRace(game, all);
    const word = eventsOf(red.drawer.socket, 'word:secret').at(-1);
    for (const op of stroke) red.drawer.socket.emit('draw:op', op);
    await nextEvent(red.guessers[0].socket, 'draw:op', (op: DrawOp) => op.t === 'move');

    const back = await reconnect(ts, red.drawer.socket, red.drawer.name, red.drawer.sessionId, game.code);
    expect(back.res.ok).toBe(true);
    expect(await nextEvent(back.socket, 'word:secret')).toBe(word);
    const history = (await nextEvent<unknown[]>(back.socket, 'draw:history')) as unknown[];
    expect(history).toHaveLength(1);
    // Kaldığı yerden çizmeye devam edebilir.
    back.socket.emit('draw:op', { t: 'start', color: '#ff0000', size: 4, x: 50, y: 50 });
    await nextEvent(red.guessers[0].socket, 'draw:op', (op: DrawOp) => op.t === 'start' && op.x === 50);
  });

  it('bir takımda 2 kişiden az kalırsa oyun biter', async () => {
    const { game, all } = await teamsRoom();
    const { blue } = await startRace(game, all);
    const from = game.host.log.length;
    blue.guessers[0].socket.emit('room:leave');
    const end = await nextEvent<RoomState>(game.host, 'room:state', (s) => s.phase === 'gameEnd', from);
    expect(end.teams?.race).toBeNull();
    expect(eventsOf(game.host, 'chat:message').some((m) => (m as ChatMessage).key === 'teamTooSmall')).toBe(true);
  });

  it('tüm turlar oynanınca oyun biter, skor görünür; tekrar oynayınca takımlar korunur', async () => {
    const { game, all } = await teamsRoom(3, 2); // 2 tur × 2 kişilik takım = 4 el
    const start = await startRace(game, all);
    let from = game.host.log.length;
    for (let turn = 1; turn <= 4; turn++) {
      const state =
        turn === 1
          ? start.state
          : await nextEvent<RoomState>(
              game.host,
              'room:state',
              (s) => s.teams?.race?.turn === turn && s.teams.race.stage === 'draw',
              from,
            );
      const redDrawer = state.teams?.race?.drawers.red as string;
      const drawer = all.find((m) => m.id === redDrawer) as Member;
      const guesser = all.find((m) => start.teamOf(m.id) === 'red' && m.id !== redDrawer) as Member;
      const word = (await nextEvent<string>(drawer.socket, 'word:secret', () => true, drawer.socket.log.length - 5)) as string;
      if (turn === 1) {
        for (const op of stroke) drawer.socket.emit('draw:op', op);
        await nextEvent(guesser.socket, 'draw:op', (op: DrawOp) => op.t === 'move');
      }
      from = game.host.log.length;
      guesser.socket.emit('chat:send', word);
      await nextEvent<RoomState>(game.host, 'room:state', (s) => s.teams?.race?.stage === 'result', from);
    }
    const end = await nextEvent<RoomState>(game.host, 'room:state', (s) => s.phase === 'gameEnd', from);
    expect(end.teams?.score).toEqual({ red: 4, blue: 0 });
    expect(
      eventsOf(game.host, 'chat:message').some(
        (m) => (m as ChatMessage).key === 'teamWon' && (m as ChatMessage).vars?.team === 'red',
      ),
    ).toBe(true);

    // Galeride sadece çizilen (ilk turdaki kırmızı) resim var; takımı ve çizeni yazılı.
    const got = nextEvent<GalleryItem[]>(game.host, 'game:gallery', () => true);
    game.host.emit('gallery:get');
    const gallery = await got;
    expect(gallery).toHaveLength(1);
    expect(gallery[0].team).toBe('red');
    expect(gallery[0].drawerName).toBeTruthy();

    const membersBefore = end.teams?.members;
    game.host.emit('game:restart');
    const lobby = await waitForState(game.host, (s) => s.phase === 'lobby');
    expect(lobby.teams?.members).toEqual(membersBefore);
    expect(lobby.teams?.score).toEqual({ red: 0, blue: 0 });
  }, 20_000);
});
