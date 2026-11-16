import { useEffect, useState } from 'react';
import type { GameData } from '../App';
import AvatarBadge from '../components/AvatarBadge';
import Board from '../components/Board';
import Chat from '../components/Chat';
import PlayerList from '../components/PlayerList';
import SoundToggle from '../components/SoundToggle';
import { socket } from '../socket';
import { play } from '../sound';

interface Floater {
  id: number;
  emoji: string;
  name: string;
  left: number;
}
let floaterId = 0;

function useNow(intervalMs: number) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export default function Game({ data }: { data: GameData }) {
  const { room, meId, secret, choices, stateAt } = data;
  const now = useNow(250);
  const [reacted, setReacted] = useState<string | null>(null);

  const drawer = room.players.find((p) => p.id === room.drawerId);
  const me = room.players.find((p) => p.id === meId);
  const iAmDrawer = room.drawerId === meId;
  const turnKey = `${room.round}-${room.drawerId}`;

  const timeLeft = room.timeLeftMs === null ? 0 : Math.max(0, room.timeLeftMs - (now - stateAt));
  const seconds = Math.ceil(timeLeft / 1000);
  const progress = room.phaseDurationMs ? timeLeft / room.phaseDurationMs : 0;
  const urgent = room.phase === 'drawing' && seconds <= 10;

  // Son 5 saniyede tik-tak
  useEffect(() => {
    if (room.phase === 'drawing' && seconds > 0 && seconds <= 5) play(seconds <= 3 ? 'tickHigh' : 'tick');
  }, [seconds, room.phase]);

  // Tepkiler tuvalin üstünde uçuşur
  const [floaters, setFloaters] = useState<Floater[]>([]);
  useEffect(() => {
    const onReaction = ({ kind, name }: { kind: 'like' | 'dislike'; name: string }) => {
      const f = { id: ++floaterId, emoji: kind === 'like' ? '👍' : '👎', name, left: 10 + Math.random() * 80 };
      setFloaters((list) => [...list, f]);
      setTimeout(() => setFloaters((list) => list.filter((x) => x.id !== f.id)), 2200);
      play('pop');
    };
    socket.on('reaction', onReaction);
    return () => {
      socket.off('reaction', onReaction);
    };
  }, []);

  // ---- Üst bardaki kelime alanı ----
  let wordArea;
  if (room.phase === 'choosing') {
    wordArea = <span className="muted">Kelime seçiliyor…</span>;
  } else if (room.phase === 'turnEnd') {
    wordArea = <span className="word-reveal">{room.turnResult?.word || '—'}</span>;
  } else if (secret) {
    wordArea = (
      <span className={'word-secret' + (iAmDrawer ? '' : ' guessed')}>
        {iAmDrawer ? 'Çiz: ' : '✅ '}
        {secret}
      </span>
    );
  } else if (room.hint) {
    const letterCount = room.hint.filter((c) => c !== ' ').length;
    wordArea = (
      <span className="hint">
        {room.hint.map((c, i) => (
          <span key={i} className={c === ' ' ? 'gap' : c === '_' ? 'blank' : 'letter'}>{c === '_' ? '' : c}</span>
        ))}
        <sup>{letterCount}</sup>
      </span>
    );
  }

  // ---- Tuval üstündeki katman ----
  let overlay = null;
  if (room.phase === 'choosing') {
    overlay = iAmDrawer && choices.length ? (
      <div className="overlay-card your-turn">
        <div className="your-turn-badge">🎨 Senin sıran!</div>
        <h3>Çizeceğin kelimeyi seç</h3>
        <div className="choices">
          {choices.map((w, i) => (
            <button
              key={w}
              className="btn btn-primary stagger"
              style={{ animationDelay: `${0.15 + i * 0.1}s` }}
              onClick={() => socket.emit('word:choose', i)}
            >
              {w}
            </button>
          ))}
        </div>
        <p className="muted small">{seconds} sn içinde seçmezsen rastgele seçilecek</p>
      </div>
    ) : (
      <div className="overlay-card">
        {drawer && <AvatarBadge avatar={drawer.avatar} size={64} />}
        <h3>{drawer?.name ?? 'Biri'} kelime seçiyor…</h3>
        <p className="muted">Tur {room.round}/{room.settings.rounds}</p>
      </div>
    );
  } else if (room.phase === 'turnEnd' && room.turnResult) {
    const r = room.turnResult;
    const rows = [...room.players].sort((a, b) => (r.gains[b.id] ?? 0) - (r.gains[a.id] ?? 0));
    overlay = (
      <div className="overlay-card">
        <p className="muted">
          {r.reason === 'allGuessed' ? 'Herkes bildi! 🎉' : r.reason === 'drawerLeft' ? 'Çizen oyuncu ayrıldı' : 'Süre doldu ⏰'}
        </p>
        {r.word && <h3>Kelime: <span className="word-reveal">{r.word}</span></h3>}
        <ul className="gains">
          {rows.map((p, i) => (
            <li key={p.id} className="stagger" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
              <span>{p.avatar.face} {p.name}</span>
              <b className={(r.gains[p.id] ?? 0) > 0 ? 'plus' : 'zero'}>+{r.gains[p.id] ?? 0}</b>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="game">
      <header className="topbar">
        <div className="round">
          <button className="icon-btn small" onClick={() => confirm('Oyundan çıkmak istiyor musun?') && data.leave()} title="Çık">✕</button>
          <span>Tur {room.round}/{room.settings.rounds}</span>
        </div>
        <div className="word-area">{wordArea}</div>
        <div className="top-right">
          <SoundToggle className="small" />
          <div className={'timer' + (urgent ? ' urgent' : '')}>⏱ {seconds}</div>
        </div>
        <div className="progress"><span style={{ width: `${progress * 100}%` }} /></div>
      </header>

      <aside className="side-players">
        <PlayerList room={room} meId={meId} />
      </aside>

      <main className="main-board">
        <Board canDraw={iAmDrawer && room.phase === 'drawing'} overlay={overlay} />
        <div className="floaters" aria-hidden>
          {floaters.map((f) => (
            <span key={f.id} className="floater" style={{ left: `${f.left}%` }}>
              {f.emoji}
              <small>{f.name}</small>
            </span>
          ))}
        </div>
        {room.phase === 'drawing' && !iAmDrawer && (
          <div className="react-row">
            <span className="muted small">{drawer?.name} çiziyor{me?.guessed ? ' · sen bildin!' : ''}</span>
            <span className="react-btns">
              {(['like', 'dislike'] as const).map((k) => (
                <button
                  key={k}
                  className="icon-btn"
                  disabled={reacted === turnKey}
                  onClick={() => {
                    socket.emit('react', k);
                    setReacted(turnKey);
                  }}
                >
                  {k === 'like' ? '👍' : '👎'}
                </button>
              ))}
            </span>
          </div>
        )}
      </main>

      <section className="side-chat">
        <Chat data={data} compact />
      </section>
    </div>
  );
}
