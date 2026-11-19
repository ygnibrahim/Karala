// Çizim Yarışı ekranı: iki takımın çizenleri aynı kelimeyi aynı anda kendi takımına çizer.
// Herkes sadece kendi takımının tuvalini ve sohbetini görür; tur sonunda iki çizim yan yana gösterilir.
import { type RoomState, TEAM_IDS, type TeamId, type TeamRacePublic, type TeamsPublic } from '@shared';
import { useEffect } from 'react';
import Board from '../components/board/Board';
import AnimatedNumber from '../components/common/AnimatedNumber';
import AvatarBadge from '../components/common/AvatarBadge';
import DrawingView from '../components/common/DrawingView';
import PlayerActions from '../components/common/PlayerActions';
import Chat from '../components/game/Chat';
import TopBar from '../components/game/TopBar';
import { play } from '../effects/sound';
import { useCountdown } from '../hooks/useCountdown';
import { useT } from '../i18n';
import type { GameData } from '../types';

const URGENT_SECONDS = 10;
const TICK_SECONDS = 5;

export default function TeamRace({ data }: { data: GameData }) {
  const t = useT();
  const { room, meId, secret, stateAt } = data;
  const teams = room.teams;
  const race = teams?.race;
  const { seconds, progress } = useCountdown(room, stateAt);
  const drawing = race?.stage === 'draw';

  useEffect(() => {
    if (drawing && seconds > 0 && seconds <= TICK_SECONDS) play(seconds <= 3 ? 'tickHigh' : 'tick');
  }, [seconds, drawing]);

  if (!teams || !race) return null;
  const myTeam: TeamId | undefined = teams.members[meId];
  const iAmDrawer = !!myTeam && race.drawers[myTeam] === meId;
  // Önceki turun kelimesi ekranda kalmasın: sadece bu turun çizeni kelimeyi görür.
  const word = iAmDrawer ? secret : null;
  const nameOf = (id: string | null | undefined) => room.players.find((p) => p.id === id)?.name ?? '—';
  const teamName = (team: TeamId) => t(`team.${team}`);

  const placeholder = !myTeam
    ? t('race.chatSpectator')
    : race.stage === 'result'
      ? t('race.chatAll')
      : iAmDrawer
        ? t('race.chatDrawer')
        : t('race.chatGuess');

  return (
    <div className={`game team-race${myTeam ? ` team-${myTeam}` : ''}`}>
      <TopBar
        title={t('common.round', { round: race.turn, total: race.totalTurns })}
        seconds={seconds}
        progress={progress}
        urgent={drawing && seconds <= URGENT_SECONDS}
        onLeave={data.leave}
      >
        <TeamWord room={room} race={race} word={word} />
      </TopBar>

      <aside className="side-players">
        <TeamRoster room={room} teams={teams} meId={meId} myTeam={myTeam} />
      </aside>

      <main className="main-board">
        <Board
          canDraw={iAmDrawer && drawing}
          overlay={
            race.stage === 'intro' ? (
              <Intro race={race} myTeam={myTeam} word={word} nameOf={nameOf} />
            ) : race.stage === 'result' ? (
              <Result race={race} myTeam={myTeam} nameOf={nameOf} />
            ) : undefined
          }
        />
        <div className={`imp-panel team-panel${myTeam ? ` team-${myTeam}` : ''}`}>
          <Scoreboard score={teams.score} />
          <span className="muted small">
            {!myTeam
              ? t('common.spectating')
              : iAmDrawer
                ? t('race.youDraw', { team: teamName(myTeam) })
                : t('race.teammateDraws', { team: teamName(myTeam), name: nameOf(race.drawers[myTeam]) })}
          </span>
        </div>
      </main>

      <section className="side-chat">
        <Chat data={data} compact placeholder={placeholder} />
      </section>
    </div>
  );
}

function Scoreboard({ score }: { score: Record<TeamId, number> }) {
  const t = useT();
  return (
    <span className="scoreboard" role="img" aria-label={t('race.score', { red: score.red, blue: score.blue })}>
      <span className="team-dot red">🔴</span>
      <b>
        <AnimatedNumber value={score.red} />
      </b>
      <span className="muted">–</span>
      <b>
        <AnimatedNumber value={score.blue} />
      </b>
      <span className="team-dot blue">🔵</span>
    </span>
  );
}

/** Üst barda: çizene kelime, tahmin edenlere ipucu harfleri, tur sonunda kelimenin kendisi. */
function TeamWord({ room, race, word }: { room: RoomState; race: TeamRacePublic; word: string | null }) {
  const t = useT();
  if (race.stage === 'result') return <span className="word-reveal">{race.result?.word}</span>;
  if (word) return <span className="word-secret">{t('game.drawThis', { word })}</span>;
  if (race.stage === 'intro') return <span className="muted">{t('race.ready')}</span>;
  if (!room.hint) return null;
  return (
    <span className="hint">
      {room.hint.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: harfin konumu kimliğidir
        <span key={i} className={c === ' ' ? 'gap' : c === '_' ? 'blank' : 'letter'}>
          {c === '_' ? '' : c}
        </span>
      ))}
      <sup>{room.hint.filter((c) => c !== ' ').length}</sup>
    </span>
  );
}

function Intro({
  race,
  myTeam,
  word,
  nameOf,
}: {
  race: TeamRacePublic;
  myTeam: TeamId | undefined;
  word: string | null;
  nameOf: (id: string | null) => string;
}) {
  const t = useT();
  return (
    <div className="overlay-card team-intro">
      <p className="muted">{t('common.round', { round: race.turn, total: race.totalTurns })}</p>
      <div className="versus">
        <span className="team-chip red">🔴 {nameOf(race.drawers.red)}</span>
        <b>⚔️</b>
        <span className="team-chip blue">🔵 {nameOf(race.drawers.blue)}</span>
      </div>
      {word ? (
        <>
          <p>{t('race.drawForTeam')}</p>
          <div className="imp-word">{word}</div>
          <p className="muted small">{t('race.rivalSameWord')}</p>
        </>
      ) : (
        <p>{myTeam ? t('race.drawsForYou', { name: nameOf(race.drawers[myTeam]) }) : t('race.bothDrawing')}</p>
      )}
    </div>
  );
}

function Result({
  race,
  myTeam,
  nameOf,
}: {
  race: TeamRacePublic;
  myTeam: TeamId | undefined;
  nameOf: (id: string | null) => string;
}) {
  const t = useT();
  const r = race.result;
  if (!r) return null;
  const headline = !r.winner
    ? t('race.timeUp')
    : r.winner === myTeam
      ? t('race.youWon', { name: nameOf(r.guesserId) })
      : t('race.theyWon', { team: t(`team.${r.winner}`), name: nameOf(r.guesserId) });
  return (
    <div className="overlay-card team-result">
      <p className="team-headline">{headline}</p>
      <p>
        {t('common.word')} <span className="word-reveal">{r.word}</span>
      </p>
      <div className="team-drawings">
        {TEAM_IDS.map((team) => (
          <figure key={team} className={`team-drawing ${team}${r.winner === team ? ' winner' : ''}`}>
            <DrawingView drawing={r.drawings[team]} />
            <figcaption>
              {t(`team.${team}`)}
              {r.winner === team && ' 🏆'}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

/** Sol tarafta iki takımın oyuncuları: önce kendi takımın. */
function TeamRoster({
  room,
  teams,
  meId,
  myTeam,
}: {
  room: RoomState;
  teams: TeamsPublic;
  meId: string;
  myTeam: TeamId | undefined;
}) {
  const t = useT();
  const viewerIsHost = !!room.players.find((p) => p.id === meId)?.isHost;
  const order = myTeam === 'blue' ? (['blue', 'red'] as const) : TEAM_IDS;
  return (
    <div className="team-roster">
      {order.map((team) => (
        <section key={team} className={`team-group ${team}`}>
          <h3>
            <span className="team-name">{t(team === 'red' ? 'team.redShort' : 'team.blueShort')}</span>
            <b title={t('race.teamScore', { team: t(`team.${team}`) })}>{teams.score[team]}</b>
          </h3>
          <ul className="players">
            {room.players
              .filter((p) => teams.members[p.id] === team)
              .map((p) => {
                const drawer = teams.race?.drawers[team] === p.id;
                return (
                  <li
                    key={p.id}
                    className={`${drawer ? 'drawer' : ''}${p.id === meId ? ' me' : ''}${p.connected ? '' : ' offline'}`}
                  >
                    <AvatarBadge avatar={p.avatar} size={30} />
                    <span className="pinfo">
                      <span className="name">
                        {p.name}
                        {p.id === meId && ` ${t('common.you')}`}
                      </span>
                      <span className="score">{t('common.points', { n: p.score })}</span>
                    </span>
                    {drawer && <span className="tag">✏️</span>}
                    <PlayerActions viewerIsHost={viewerIsHost} viewerId={meId} targetId={p.id} targetName={p.name} />
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
