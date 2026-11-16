import type { RoomState } from '@shared';
import AvatarBadge from '../common/AvatarBadge';

/** Lobide gösterilecek en fazla boş yer. */
const MAX_EMPTY_SLOTS = 3;

export default function LobbyPlayers({ room, meId }: { room: RoomState; meId: string }) {
  const emptySlots = Math.max(0, Math.min(MAX_EMPTY_SLOTS, room.settings.maxPlayers - room.players.length));

  return (
    <section className="card">
      <h2>
        Oyuncular{' '}
        <span className="muted">
          ({room.players.length}/{room.settings.maxPlayers})
        </span>
      </h2>
      <ul className="lobby-players">
        {room.players.map((p) => (
          <li key={p.id} className={p.connected ? '' : 'offline'}>
            <AvatarBadge avatar={p.avatar} size={48} />
            <span className="name">
              {p.name}
              {p.id === meId && <span className="muted"> (sen)</span>}
            </span>
            {p.isHost && <span title="Oda sahibi">👑</span>}
          </li>
        ))}
        {Array.from({ length: emptySlots }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: boş yerlerin kimliği yok, sırası değişmez
          <li key={`bos-${i}`} className="empty-slot">
            <span className="avatar empty">?</span>
            <span className="muted">Bekleniyor…</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
