// Sahtekâr ekranı: roller, sırayla tek çizgi, oylama, sahtekârın tahmini ve sonuç.
import type { ImpostorPublic, ImpostorRole, RoomState } from '@shared';
import { type FormEvent, useState } from 'react';
import Board from '../components/board/Board';
import AvatarBadge from '../components/common/AvatarBadge';
import PlayerActions from '../components/common/PlayerActions';
import Chat from '../components/game/Chat';
import TopBar from '../components/game/TopBar';
import { useCountdown } from '../hooks/useCountdown';
import { type Key, useT } from '../i18n';
import { socket } from '../lib/socket';
import type { GameData } from '../types';

export default function Impostor({ data }: { data: GameData }) {
  const t = useT();
  const { room, meId, role, stateAt } = data;
  const imp = room.impostor;
  const { seconds, progress } = useCountdown(room, stateAt);
  if (!imp) return null;

  const myTurn = imp.stage === 'draw' && imp.turnPlayerId === meId;
  const showOverlay = imp.stage === 'intro' || imp.stage === 'result';

  return (
    <div className="game">
      <TopBar
        title={t('common.round', { round: imp.round, total: imp.totalRounds })}
        seconds={seconds}
        progress={progress}
        urgent={seconds <= 5 && imp.stage !== 'intro' && imp.stage !== 'result'}
        onLeave={data.leave}
      >
        <RoleBadge role={role} category={imp.category} />
      </TopBar>

      <aside className="side-players">
        <TurnOrder room={room} imp={imp} meId={meId} />
      </aside>

      <main className="main-board">
        <Board
          canDraw={myTurn}
          noEditing
          onStrokeEnd={() => socket.emit('imp:done')}
          overlay={
            showOverlay ? (
              imp.stage === 'intro' ? (
                <Intro role={role} imp={imp} />
              ) : (
                <Result room={room} imp={imp} meId={meId} />
              )
            ) : undefined
          }
        />
        <StagePanel room={room} imp={imp} meId={meId} role={role} myTurn={myTurn} />
      </main>

      <section className="side-chat">
        <Chat data={data} compact />
      </section>
    </div>
  );
}

/** Üst barda: kelime (ya da sahtekâr uyarısı) ve kategori. */
function RoleBadge({ role, category: id }: { role: ImpostorRole | null; category: string }) {
  const t = useT();
  const category = t(`category.${id}` as Key);
  if (!role) return <span className="muted">{t('imp.spectating', { category })}</span>;
  return role.isImpostor ? (
    <span className="imp-role impostor">{t('imp.youAreImpostor', { category })}</span>
  ) : (
    <span className="imp-role">
      {t('common.word')} <b>{role.word}</b> <span className="muted small">· {category}</span>
    </span>
  );
}

function Intro({ role, imp }: { role: ImpostorRole | null; imp: ImpostorPublic }) {
  const t = useT();
  return (
    <div className={`overlay-card imp-intro${role?.isImpostor ? ' impostor' : ''}`}>
      <p className="muted">
        {t('imp.categoryLine', {
          round: imp.round,
          total: imp.totalRounds,
          category: t(`category.${imp.category}` as Key),
        })}
      </p>
      {!role ? (
        <h3>{t('imp.watchingRound')}</h3>
      ) : role.isImpostor ? (
        <>
          <div className="imp-big">🕵️</div>
          <h3>{t('imp.youTitle')}</h3>
          <p>{t('imp.youHint')}</p>
        </>
      ) : (
        <>
          <p>{t('common.word')}</p>
          <div className="imp-word">{role.word}</div>
          <p className="muted small">{t('imp.crewHint')}</p>
        </>
      )}
    </div>
  );
}

/** Çizimin altındaki aşama paneli: sıra bilgisi, oylama ya da tahmin. */
function StagePanel({
  room,
  imp,
  meId,
  role,
  myTurn,
}: {
  room: RoomState;
  imp: ImpostorPublic;
  meId: string;
  role: ImpostorRole | null;
  myTurn: boolean;
}) {
  const t = useT();
  const nameOf = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? t('common.someone');

  if (imp.stage === 'draw') {
    return (
      <div className={`imp-panel${myTurn ? ' my-turn' : ''}`}>
        {myTurn ? (
          <>
            <span>
              ✏️ <b>{t('imp.yourTurn')}</b> {t('imp.oneLine', { lap: imp.lap, laps: imp.totalLaps })}
            </span>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => socket.emit('imp:done')}>
              {t('imp.pass')}
            </button>
          </>
        ) : (
          <span className="muted">
            {t('imp.othersTurn', { name: nameOf(imp.turnPlayerId), lap: imp.lap, laps: imp.totalLaps })}
          </span>
        )}
      </div>
    );
  }

  if (imp.stage === 'vote') return <VotePanel room={room} imp={imp} meId={meId} canVote={!!role} />;

  if (imp.stage === 'guess') {
    return role?.isImpostor ? (
      <GuessPanel />
    ) : (
      <div className="imp-panel">
        <span>{t('imp.caughtWaiting')}</span>
      </div>
    );
  }
  return null;
}

function VotePanel({ room, imp, meId, canVote }: { room: RoomState; imp: ImpostorPublic; meId: string; canVote: boolean }) {
  const t = useT();
  const [choice, setChoice] = useState<string | null>(null);
  const voted = imp.voted.includes(meId);

  return (
    <div className="imp-panel vote">
      <b>{t('imp.whoIsIt')}</b>
      <div className="vote-options">
        {imp.order
          .filter((id) => id !== meId)
          .map((id) => {
            const p = room.players.find((x) => x.id === id);
            if (!p) return null;
            return (
              <button
                type="button"
                key={id}
                className={`vote-option${choice === id ? ' chosen' : ''}`}
                disabled={!canVote}
                onClick={() => {
                  setChoice(id);
                  socket.emit('imp:vote', id);
                }}
              >
                <AvatarBadge avatar={p.avatar} size={24} />
                <span className="vote-name">{p.name}</span>
              </button>
            );
          })}
      </div>
      <span className="muted small">
        {voted ? t('imp.voted') : ''}
        {t('imp.votes', { n: imp.voted.length, total: imp.order.length })}
      </span>
    </div>
  );
}

function GuessPanel() {
  const t = useT();
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) socket.emit('imp:guess', text.trim());
  };
  return (
    <form className="imp-panel guess" onSubmit={submit}>
      <b>{t('imp.lastChance')}</b>
      <div className="tp-input-row">
        <input
          className="input"
          value={text}
          maxLength={100}
          placeholder={t('imp.guessPlaceholder')}
          onChange={(e) => setText(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          {t('imp.guessButton')}
        </button>
      </div>
    </form>
  );
}

function Result({ room, imp, meId }: { room: RoomState; imp: ImpostorPublic; meId: string }) {
  const t = useT();
  const r = imp.result;
  if (!r) return null;
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? t('common.someone');
  const iWasImpostor = r.impostorId === meId;
  const headline = !r.caught ? t('imp.escaped') : r.guessedRight ? t('imp.caughtButKnew') : t('imp.caught');
  const counts = new Map<string, number>();
  for (const target of Object.values(r.votes)) counts.set(target, (counts.get(target) ?? 0) + 1);

  return (
    <div className="overlay-card">
      <p className="muted">{headline}</p>
      <h3>
        🕵️ {nameOf(r.impostorId)}
        {iWasImpostor ? ` ${t('common.you')}` : ''}
      </h3>
      <p>
        {t('common.word')} <span className="word-reveal">{r.word}</span>
        {r.guess && (
          <span className="muted small">
            {' '}
            · {t('imp.theirGuess', { guess: r.guess })} {r.guessedRight ? '✅' : '❌'}
          </span>
        )}
      </p>
      <ul className="gains">
        {[...counts]
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => (
            <li key={id}>
              <span>{nameOf(id)}</span>
              <b>{t('imp.voteCount', { n })}</b>
            </li>
          ))}
      </ul>
      <ul className="gains">
        {Object.entries(r.gains).map(([id, pts]) => (
          <li key={id} className="stagger">
            <span>{nameOf(id)}</span>
            <b className="plus">+{pts}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sol tarafta çizim sırası: sırası geleni ve oy verenleri gösterir. */
function TurnOrder({ room, imp, meId }: { room: RoomState; imp: ImpostorPublic; meId: string }) {
  const t = useT();
  const viewerIsHost = !!room.players.find((p) => p.id === meId)?.isHost;
  return (
    <ul className="players">
      {imp.order.map((id, i) => {
        const p = room.players.find((x) => x.id === id);
        if (!p) return null;
        const isTurn = imp.turnPlayerId === id;
        const voted = imp.stage === 'vote' && imp.voted.includes(id);
        return (
          <li
            key={id}
            className={`${isTurn ? 'drawer' : ''}${voted ? ' guessed' : ''}${id === meId ? ' me' : ''}${p.connected ? '' : ' offline'}`}
          >
            <span className="rank">{i + 1}.</span>
            <AvatarBadge avatar={p.avatar} size={34} />
            <span className="pinfo">
              <span className="name">
                {p.name}
                {id === meId && ` ${t('common.you')}`}
              </span>
              <span className="score">{t('common.points', { n: p.score })}</span>
            </span>
            {isTurn && <span className="tag">✏️</span>}
            {voted && <span className="tag">🗳️</span>}
            <PlayerActions viewerIsHost={viewerIsHost} viewerId={meId} targetId={id} targetName={p.name} />
          </li>
        );
      })}
    </ul>
  );
}
