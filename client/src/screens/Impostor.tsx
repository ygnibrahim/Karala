// Sahtekâr ekranı: roller, sırayla tek çizgi, oylama, sahtekârın tahmini ve sonuç.
import type { ImpostorPublic, ImpostorRole, RoomState } from '@shared';
import { type FormEvent, useState } from 'react';
import Board from '../components/board/Board';
import AvatarBadge from '../components/common/AvatarBadge';
import Chat from '../components/game/Chat';
import TopBar from '../components/game/TopBar';
import { useCountdown } from '../hooks/useCountdown';
import { socket } from '../lib/socket';
import type { GameData } from '../types';

export default function Impostor({ data }: { data: GameData }) {
  const { room, meId, role, stateAt } = data;
  const imp = room.impostor;
  const { seconds, progress } = useCountdown(room, stateAt);
  if (!imp) return null;

  const myTurn = imp.stage === 'draw' && imp.turnPlayerId === meId;
  const showOverlay = imp.stage === 'intro' || imp.stage === 'result';

  return (
    <div className="game">
      <TopBar
        title={`Tur ${imp.round}/${imp.totalRounds}`}
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
function RoleBadge({ role, category }: { role: ImpostorRole | null; category: string }) {
  if (!role) return <span className="muted">👀 İzliyorsun · {category}</span>;
  return role.isImpostor ? (
    <span className="imp-role impostor">🕵️ Sahtekârsın · {category}</span>
  ) : (
    <span className="imp-role">
      Kelime: <b>{role.word}</b> <span className="muted small">· {category}</span>
    </span>
  );
}

function Intro({ role, imp }: { role: ImpostorRole | null; imp: ImpostorPublic }) {
  return (
    <div className={`overlay-card imp-intro${role?.isImpostor ? ' impostor' : ''}`}>
      <p className="muted">
        Tur {imp.round}/{imp.totalRounds} · Kategori: <b>{imp.category}</b>
      </p>
      {!role ? (
        <h3>👀 Bu turu izliyorsun</h3>
      ) : role.isImpostor ? (
        <>
          <div className="imp-big">🕵️</div>
          <h3>Sahtekâr sensin!</h3>
          <p>Kelimeyi bilmiyorsun. Diğerlerinin çizgilerine bakıp çaktırmadan uyum sağla.</p>
        </>
      ) : (
        <>
          <p>Kelime:</p>
          <div className="imp-word">{role.word}</div>
          <p className="muted small">Aranızda kelimeyi bilmeyen biri var. Çok belli etmeden çiz! 🤫</p>
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
  const nameOf = (id: string | null) => room.players.find((p) => p.id === id)?.name ?? 'Biri';

  if (imp.stage === 'draw') {
    return (
      <div className={`imp-panel${myTurn ? ' my-turn' : ''}`}>
        {myTurn ? (
          <>
            <span>
              ✏️ <b>Sıra sende!</b> Tek bir çizgi çiz ({imp.lap}/{imp.totalLaps}. dönüş)
            </span>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => socket.emit('imp:done')}>
              Pas geç
            </button>
          </>
        ) : (
          <span className="muted">
            {nameOf(imp.turnPlayerId)} çiziyor… ({imp.lap}/{imp.totalLaps}. dönüş)
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
        <span>🕵️ Sahtekâr yakalandı! Kelimeyi tahmin ederse kurtulacak…</span>
      </div>
    );
  }
  return null;
}

function VotePanel({ room, imp, meId, canVote }: { room: RoomState; imp: ImpostorPublic; meId: string; canVote: boolean }) {
  const [choice, setChoice] = useState<string | null>(null);
  const voted = imp.voted.includes(meId);

  return (
    <div className="imp-panel vote">
      <b>🗳️ Sahtekâr kim?</b>
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
                <AvatarBadge avatar={p.avatar} size={28} />
                {p.name}
              </button>
            );
          })}
      </div>
      <span className="muted small">
        {voted ? '✓ Oyun verildi (değiştirebilirsin) · ' : ''}
        {imp.voted.length}/{imp.order.length} oy
      </span>
    </div>
  );
}

function GuessPanel() {
  const [text, setText] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (text.trim()) socket.emit('imp:guess', text.trim());
  };
  return (
    <form className="imp-panel guess" onSubmit={submit}>
      <b>🕵️ Yakalandın! Son şans: kelime neydi?</b>
      <div className="tp-input-row">
        <input className="input" value={text} maxLength={100} placeholder="Tahminin…" onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn btn-primary" disabled={!text.trim()}>
          Tahmin et
        </button>
      </div>
    </form>
  );
}

function Result({ room, imp, meId }: { room: RoomState; imp: ImpostorPublic; meId: string }) {
  const r = imp.result;
  if (!r) return null;
  const nameOf = (id: string) => room.players.find((p) => p.id === id)?.name ?? 'Biri';
  const iWasImpostor = r.impostorId === meId;
  const headline = !r.caught
    ? 'Sahtekâr kaçtı! 🏃'
    : r.guessedRight
      ? 'Yakalandı ama kelimeyi bildi! 😮'
      : 'Sahtekâr yakalandı! 🎉';
  const counts = new Map<string, number>();
  for (const target of Object.values(r.votes)) counts.set(target, (counts.get(target) ?? 0) + 1);

  return (
    <div className="overlay-card">
      <p className="muted">{headline}</p>
      <h3>
        🕵️ {nameOf(r.impostorId)}
        {iWasImpostor ? ' (sen)' : ''}
      </h3>
      <p>
        Kelime: <span className="word-reveal">{r.word}</span>
        {r.guess && (
          <span className="muted small">
            {' '}
            · tahmini: “{r.guess}” {r.guessedRight ? '✅' : '❌'}
          </span>
        )}
      </p>
      <ul className="gains">
        {[...counts]
          .sort((a, b) => b[1] - a[1])
          .map(([id, n]) => (
            <li key={id}>
              <span>{nameOf(id)}</span>
              <b>{n} oy</b>
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
                {id === meId && ' (sen)'}
              </span>
              <span className="score">{p.score} puan</span>
            </span>
            {isTurn && <span className="tag">✏️</span>}
            {voted && <span className="tag">🗳️</span>}
          </li>
        );
      })}
    </ul>
  );
}
