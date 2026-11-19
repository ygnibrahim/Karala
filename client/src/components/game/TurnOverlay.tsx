// Tuvalin üstündeki katman: kelime seçimi ve tur sonucu.
import type { RoomState } from '@shared';
import { type Key, useT } from '../../i18n';
import { socket } from '../../lib/socket';
import AvatarBadge from '../common/AvatarBadge';

interface Props {
  room: RoomState;
  iAmDrawer: boolean;
  choices: string[];
  seconds: number;
}

const END_REASON: Record<'allGuessed' | 'drawerLeft' | 'time', Key> = {
  allGuessed: 'game.endAllGuessed',
  drawerLeft: 'game.endDrawerLeft',
  time: 'game.endTime',
};

export default function TurnOverlay({ room, iAmDrawer, choices, seconds }: Props) {
  if (room.phase === 'choosing') {
    return iAmDrawer && choices.length ? <WordChoice choices={choices} seconds={seconds} /> : <WaitingForDrawer room={room} />;
  }
  if (room.phase === 'turnEnd' && room.turnResult) return <TurnResult room={room} />;
  return null;
}

function WordChoice({ choices, seconds }: { choices: string[]; seconds: number }) {
  const t = useT();
  return (
    <div className="overlay-card your-turn">
      <div className="your-turn-badge">{t('game.yourTurn')}</div>
      <h3>{t('game.pickWord')}</h3>
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
      <p className="muted small">{t('game.autoPick', { n: seconds })}</p>
    </div>
  );
}

function WaitingForDrawer({ room }: { room: RoomState }) {
  const t = useT();
  const drawer = room.players.find((p) => p.id === room.drawerId);
  return (
    <div className="overlay-card">
      {drawer && <AvatarBadge avatar={drawer.avatar} size={64} />}
      <h3>{t('game.isChoosing', { name: drawer?.name ?? t('common.someone') })}</h3>
      <p className="muted">{t('common.round', { round: room.round, total: room.settings.rounds })}</p>
    </div>
  );
}

function TurnResult({ room }: { room: RoomState }) {
  const t = useT();
  const result = room.turnResult;
  if (!result) return null;
  const gain = (id: string) => result.gains[id] ?? 0;
  const rows = [...room.players].sort((a, b) => gain(b.id) - gain(a.id));

  return (
    <div className="overlay-card">
      <p className="muted">{t(END_REASON[result.reason])}</p>
      {result.word && (
        <h3>
          {t('common.word')} <span className="word-reveal">{result.word}</span>
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
