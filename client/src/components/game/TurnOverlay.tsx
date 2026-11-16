// Tuvalin üstündeki katman: kelime seçimi ve tur sonucu.
import type { RoomState } from '@shared';
import { socket } from '../../lib/socket';
import AvatarBadge from '../common/AvatarBadge';

interface Props {
  room: RoomState;
  iAmDrawer: boolean;
  choices: string[];
  seconds: number;
}

const END_REASON = {
  allGuessed: 'Herkes bildi! 🎉',
  drawerLeft: 'Çizen oyuncu ayrıldı',
  time: 'Süre doldu ⏰',
} as const;

export default function TurnOverlay({ room, iAmDrawer, choices, seconds }: Props) {
  if (room.phase === 'choosing') {
    return iAmDrawer && choices.length ? <WordChoice choices={choices} seconds={seconds} /> : <WaitingForDrawer room={room} />;
  }
  if (room.phase === 'turnEnd' && room.turnResult) return <TurnResult room={room} />;
  return null;
}

function WordChoice({ choices, seconds }: { choices: string[]; seconds: number }) {
  return (
    <div className="overlay-card your-turn">
      <div className="your-turn-badge">🎨 Senin sıran!</div>
      <h3>Çizeceğin kelimeyi seç</h3>
      <div className="choices">
        {choices.map((word, i) => (
          <button
            type="button"
            key={word}
            className="btn btn-primary stagger"
            style={{ animationDelay: `${0.15 + i * 0.1}s` }}
            onClick={() => socket.emit('word:choose', i)}
          >
            {word}
          </button>
        ))}
      </div>
      <p className="muted small">{seconds} sn içinde seçmezsen rastgele seçilecek</p>
    </div>
  );
}

function WaitingForDrawer({ room }: { room: RoomState }) {
  const drawer = room.players.find((p) => p.id === room.drawerId);
  return (
    <div className="overlay-card">
      {drawer && <AvatarBadge avatar={drawer.avatar} size={64} />}
      <h3>{drawer?.name ?? 'Biri'} kelime seçiyor…</h3>
      <p className="muted">
        Tur {room.round}/{room.settings.rounds}
      </p>
    </div>
  );
}

function TurnResult({ room }: { room: RoomState }) {
  const result = room.turnResult;
  if (!result) return null;
  const gain = (id: string) => result.gains[id] ?? 0;
  const rows = [...room.players].sort((a, b) => gain(b.id) - gain(a.id));

  return (
    <div className="overlay-card">
      <p className="muted">{END_REASON[result.reason]}</p>
      {result.word && (
        <h3>
          Kelime: <span className="word-reveal">{result.word}</span>
        </h3>
      )}
      <ul className="gains">
        {rows.map((p, i) => (
          <li key={p.id} className="stagger" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
            <span>
              {p.avatar.face} {p.name}
            </span>
            <b className={gain(p.id) > 0 ? 'plus' : 'zero'}>+{gain(p.id)}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
