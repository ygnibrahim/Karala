// Lobide Çizim Yarışı seçiliyken: iki takım sütunu, takım değiştirme ve (oda sahibi için) karıştırma.
import { type RoomState, TEAM_IDS, TEAM_NAMES } from '@shared';
import { socket } from '../../lib/socket';
import AvatarBadge from '../common/AvatarBadge';
import KickButton from '../common/KickButton';

/** Takım modunda her takımda olması gereken en az oyuncu (sunucudaki TEAMS.minPerTeam ile aynı). */
export const MIN_PER_TEAM = 2;

export default function TeamPicker({ room, meId }: { room: RoomState; meId: string }) {
  const members = room.teams?.members ?? {};
  const viewerIsHost = !!room.players.find((p) => p.id === meId)?.isHost;
  const myTeam = members[meId];

  return (
    <section className="card team-picker">
      <div className="team-picker-head">
        <h2>
          Takımlar{' '}
          <span className="muted">
            ({room.players.length}/{room.settings.maxPlayers})
          </span>
        </h2>
        {viewerIsHost && (
          <button type="button" className="btn btn-secondary btn-small" onClick={() => socket.emit('team:shuffle')}>
            🔀 Karıştır
          </button>
        )}
      </div>
      <div className="team-columns">
        {TEAM_IDS.map((team) => {
          const list = room.players.filter((p) => members[p.id] === team);
          return (
            <div key={team} className={`team-column ${team}`}>
              <h3>{TEAM_NAMES[team]}</h3>
              <ul>
                {list.map((p) => (
                  <li key={p.id} className={p.connected ? '' : 'offline'}>
                    <AvatarBadge avatar={p.avatar} size={32} />
                    <span className="name">
                      {p.name}
                      {p.id === meId && <span className="muted"> (sen)</span>}
                    </span>
                    {p.isHost && <span title="Oda sahibi">👑</span>}
                    <KickButton viewerIsHost={viewerIsHost} viewerId={meId} targetId={p.id} targetName={p.name} />
                  </li>
                ))}
                {list.length < MIN_PER_TEAM && <li className="team-need muted small">En az {MIN_PER_TEAM} kişi gerekli</li>}
              </ul>
              {myTeam !== team && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small team-join"
                  onClick={() => socket.emit('team:join', team)}
                >
                  Bu takıma geç →
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Her iki takımda da yeterli bağlı oyuncu var mı? */
export function teamsReady(room: RoomState): boolean {
  const members = room.teams?.members ?? {};
  return TEAM_IDS.every((team) => room.players.filter((p) => p.connected && members[p.id] === team).length >= MIN_PER_TEAM);
}
