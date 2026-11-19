import type { RoomState } from '@shared';
import { useT } from '../../i18n';
import AnimatedNumber from '../common/AnimatedNumber';
import AvatarBadge from '../common/AvatarBadge';
import PlayerActions from '../common/PlayerActions';

export default function PlayerList({ room, meId }: { room: RoomState; meId: string }) {
  const t = useT();
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const viewerIsHost = !!room.players.find((p) => p.id === meId)?.isHost;
  const rankOf = (id: string) => ranked.findIndex((p) => p.id === id) + 1;

  const gains = room.phase === 'turnEnd' ? (room.turnResult?.gains ?? {}) : {};

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
          ]
            .filter(Boolean)
            .join(' ')}
        >
          <span className="rank">#{rankOf(p.id)}</span>
          <AvatarBadge avatar={p.avatar} size={34} />
          <span className="pinfo">
            <span className="name">
              {p.name}
              {p.id === meId && ` ${t('common.you')}`}
            </span>
            <span className="score">
              <AnimatedNumber value={p.score} /> {t('common.pointsUnit')}
            </span>
          </span>
          {p.id === room.drawerId && (
            <span className="tag" title={t('game.drawingTag')}>
              ✏️
            </span>
          )}
          {p.guessed && (
            <span className="tag" title={t('game.guessedTag')}>
              ✅
            </span>
          )}
          <PlayerActions viewerIsHost={viewerIsHost} viewerId={meId} targetId={p.id} targetName={p.name} />
          {(gains[p.id] ?? 0) > 0 && (
            <span key={`${room.round}-${room.drawerId}`} className="gain-float">
              +{gains[p.id]}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
