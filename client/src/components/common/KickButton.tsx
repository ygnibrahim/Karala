// Oda sahibinin bir oyuncuyu odadan çıkarma butonu (sadece oda sahibi görür, kendisi için görünmez).
import { socket } from '../../lib/socket';

interface Props {
  /** Bakan kişi oda sahibi mi? */
  viewerIsHost: boolean;
  viewerId: string;
  targetId: string;
  targetName: string;
}

export default function KickButton({ viewerIsHost, viewerId, targetId, targetName }: Props) {
  if (!viewerIsHost || viewerId === targetId) return null;
  return (
    <button
      type="button"
      className="kick-btn"
      title={`${targetName} adlı oyuncuyu çıkar`}
      aria-label={`${targetName} adlı oyuncuyu odadan çıkar`}
      onClick={(e) => {
        e.stopPropagation();
        if (confirm(`${targetName} odadan çıkarılsın mı? Bu odaya tekrar giremeyecek.`)) socket.emit('room:kick', targetId);
      }}
    >
      ✕
    </button>
  );
}
