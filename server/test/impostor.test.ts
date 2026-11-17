// Sahtekâr: oylama/puan kuralları + uçtan uca oyun ve hile denemeleri.
import type { ChatMessage, DrawOp, ImpostorRole, RoomState } from '@shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IMPOSTOR_SCORING } from '../src/config';
import { impostorGains, isCaught } from '../src/game/ImpostorGame';
import {
  type Client,
  eventsOf,
  type Game,
  settle,
  setupRoom,
  startServer,
  type TestServer,
  waitFor,
  waitForState,
} from './helpers';

describe('oylama ve puan kuralları', () => {
  it('en çok oyu tek başına alan sahtekârsa yakalanır', () => {
    expect(isCaught({ a: 'imp', b: 'imp', imp: 'a' }, 'imp')).toBe(true);
    expect(isCaught({ a: 'b', b: 'imp', imp: 'a' }, 'imp')).toBe(false); // beraberlik → kaçar
    expect(isCaught({ a: 'b', b: 'a' }, 'imp')).toBe(false);
    expect(isCaught({}, 'imp')).toBe(false); // kimse oy vermedi
  });

  it('puanlar: kaçan sahtekâr, kelimeyi bilen sahtekâr, yakalanan sahtekâr', () => {
    const players = ['a', 'b', 'imp'];
    expect(impostorGains(players, 'imp', {}, false, false)).toEqual({ imp: IMPOSTOR_SCORING.escaped });
    expect(impostorGains(players, 'imp', { a: 'imp', b: 'imp' }, true, true)).toEqual({ imp: IMPOSTOR_SCORING.guessedWord });
    expect(impostorGains(players, 'imp', { a: 'imp', b: 'a' }, true, false)).toEqual({
      a: IMPOSTOR_SCORING.caught + IMPOSTOR_SCORING.correctVote,
      b: IMPOSTOR_SCORING.caught,
    });
  });
});

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

interface Setup {
  game: Game;
  players: { socket: Client; id: string; role: ImpostorRole }[];
  impostor: { socket: Client; id: string };
  word: string;
}

async function startImpostor(): Promise<Setup> {
  const game = await setupRoom(ts, 2);
  game.host.emit('room:settings', { mode: 'impostor', rounds: 2 });
  await waitForState(game.host, (s) => s.settings.mode === 'impostor');
  const all = [{ socket: game.host, id: game.hostId }, ...game.others];
  const roles = all.map((p) => waitFor<ImpostorRole>(p.socket, 'imp:role'));
  game.host.emit('game:start');
  const received = await Promise.all(roles);
  const players = all.map((p, i) => ({ ...p, role: received[i] }));
  const impostor = players.find((p) => p.role.isImpostor);
  if (!impostor) throw new Error('sahtekâr yok');
  const word = players.find((p) => !p.role.isImpostor)?.role.word ?? '';
  return { game, players, impostor, word };
}

/** Çizim aşamasında sırası gelen oyuncuyu bulur. */
async function currentTurn(s: Setup, previous?: string): Promise<Setup['players'][number]> {
  const state = await waitForState(
    s.game.host,
    (st) => st.impostor?.stage === 'draw' && !!st.impostor.turnPlayerId && st.impostor.turnPlayerId !== previous,
    8000,
  );
  const p = s.players.find((x) => x.id === state.impostor?.turnPlayerId);
  if (!p) throw new Error('sıra kimde?');
  return p;
}

describe('Sahtekâr uçtan uca', () => {
  it('roller: bir sahtekâr, kelime sadece diğerlerine, kategori herkese', async () => {
    const s = await startImpostor();
    expect(s.players.filter((p) => p.role.isImpostor)).toHaveLength(1);
    expect(s.impostor.socket).toBeDefined();
    expect(s.players.find((p) => p.role.isImpostor)?.role.word).toBeNull();
    const words = new Set(s.players.filter((p) => !p.role.isImpostor).map((p) => p.role.word));
    expect(words.size).toBe(1);
    expect(new Set(s.players.map((p) => p.role.category)).size).toBe(1);
    // Sahtekâra hiçbir yoldan kelime gitmedi.
    expect(JSON.stringify(s.impostor.socket.log)).not.toContain(`"${s.word}"`);
    // Herkese açık durumda sonuç (dolayısıyla sahtekâr) ve kelime yok.
    const pub = lastState(s.game.host).impostor;
    expect(pub?.result).toBeNull();
    expect(JSON.stringify(pub)).not.toContain(s.word);
  }, 20_000);

  it('sırayla tek çizgi; sırası gelmeyen çizemez, ikinci çizgi ve silme yok', async () => {
    const s = await startImpostor();
    const turn = await currentTurn(s);
    const other = s.players.find((p) => p.id !== turn.id) as Setup['players'][number];
    const watcher = s.players.find((p) => p.id !== turn.id && p.id !== other.id) as Setup['players'][number];

    other.socket.emit('draw:op', stroke[0]);
    for (const op of stroke) turn.socket.emit('draw:op', op);
    turn.socket.emit('draw:op', { t: 'start', color: '#ff0000', size: 6, x: 99, y: 99 });
    turn.socket.emit('draw:op', { t: 'clear' });
    turn.socket.emit('draw:op', { t: 'undo' });
    await settle();
    expect(eventsOf(watcher.socket, 'draw:op')).toEqual(stroke);

    turn.socket.emit('imp:done');
    const nextTurn = await currentTurn(s, turn.id);
    expect(nextTurn.id).not.toBe(turn.id);
  }, 20_000);

  it('kelimeyi sohbete yazmak engellenir', async () => {
    const s = await startImpostor();
    const crew = s.players.find((p) => !p.role.isImpostor) as Setup['players'][number];
    crew.socket.emit('chat:send', `bence ${s.word.toUpperCase()} çok kolay`);
    const warning = await waitFor<ChatMessage>(crew.socket, 'chat:message', (m) => m.kind === 'close');
    expect(warning.text).toContain('Kelimeyi yazamazsın');
    await settle();
    expect(JSON.stringify(s.impostor.socket.log)).not.toContain(s.word);
  }, 20_000);

  it('tam tur: çizim → oylama → yakalanma → yanlış tahmin → puanlar', async () => {
    const s = await startImpostor();
    // 3 oyuncu × 2 dönüş = 6 sıra; herkes pas geçer.
    await currentTurn(s);
    for (let i = 0; i < 6; i++) {
      const st = lastState(s.game.host).impostor;
      const turn = s.players.find((p) => p.id === st?.turnPlayerId);
      if (!turn) break;
      const next = waitForState(s.game.host, (x) => x.impostor?.stage === 'vote' || x.impostor?.turnPlayerId !== turn.id);
      turn.socket.emit('imp:done');
      await next;
    }
    expect(lastState(s.game.host).impostor?.stage).toBe('vote');

    const crew = s.players.filter((p) => !p.role.isImpostor);
    // Kendine oy verilemez.
    crew[0].socket.emit('imp:vote', crew[0].id);
    await settle();
    expect(lastState(s.game.host).impostor?.voted).toEqual([]);

    const guessing = waitForState(s.game.host, (st) => st.impostor?.stage === 'guess');
    for (const p of crew) p.socket.emit('imp:vote', s.impostor.id);
    s.impostor.socket.emit('imp:vote', crew[0].id);
    await guessing;

    // Sadece sahtekâr tahmin edebilir.
    crew[0].socket.emit('imp:guess', s.word);
    await settle();
    expect(lastState(s.game.host).impostor?.stage).toBe('guess');

    const result = waitForState(s.game.host, (st) => st.impostor?.stage === 'result');
    s.impostor.socket.emit('imp:guess', 'kesinlikle yanlış bir tahmin');
    const end = await result;
    expect(end.impostor?.result).toMatchObject({ impostorId: s.impostor.id, word: s.word, caught: true, guessedRight: false });
    for (const p of crew) {
      expect(end.players.find((x) => x.id === p.id)?.score).toBe(IMPOSTOR_SCORING.caught + IMPOSTOR_SCORING.correctVote);
    }
    expect(end.players.find((x) => x.id === s.impostor.id)?.score).toBe(0);
  }, 30_000);
});
