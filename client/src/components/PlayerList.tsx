import type { RoomState } from '../../../shared/protocol';
import AnimatedNumber from './AnimatedNumber';
import AvatarBadge from './AvatarBadge';

export default function PlayerList({ room, meId }: { room: RoomState; meId: string }) {
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const rankOf = (id: string) => ranked.findIndex((p) => p.id === id) + 1;

  const gains = room.phase === 'turnEnd' ? room.turnResult?.gains ?? {} : {};

  return (
    <ul className="players">
      {room.players.map((p) => (
        <li
          key={p.id}
          className={[
            p.guessed && 'guessed',
            p.id === room.drawerId && 'drawer',
            !p.connected && 'offline',
            p.id === meId && 'me',
          ].filter(Boolean).join(' ')}
        >
          <span className="rank">#{rankOf(p.id)}</span>
          <AvatarBadge avatar={p.avatar} size={34} />
          <span className="pinfo">
            <span className="name">{p.name}{p.id === meId && ' (sen)'}</span>
            <span className="score"><AnimatedNumber value={p.score} /> puan</span>
          </span>
          {p.id === room.drawerId && <span className="tag" title="Çiziyor">✏️</span>}
          {p.guessed && <span className="tag" title="Bildi">✅</span>}
          {(gains[p.id] ?? 0) > 0 && <span key={`${room.round}-${room.drawerId}`} className="gain-float">+{gains[p.id]}</span>}
        </li>
      ))}
    </ul>
  );
}
