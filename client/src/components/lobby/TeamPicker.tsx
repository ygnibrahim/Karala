// Lobide Çizim Yarışı seçiliyken: iki takım sütunu, takım değiştirme ve (oda sahibi için) karıştırma.
import { type RoomState, TEAM_IDS } from '@shared';
import { useT } from '../../i18n';
import { socket } from '../../lib/socket';
import AvatarBadge from '../common/AvatarBadge';
import PlayerActions from '../common/PlayerActions';

/** Takım modunda her takımda olması gereken en az oyuncu (sunucudaki TEAMS.minPerTeam ile aynı). */
export const MIN_PER_TEAM = 2;

export default function TeamPicker({ room, meId }: { room: RoomState; meId: string }) {
  const t = useT();
  const members = room.teams?.members ?? {};
  const viewerIsHost = !!room.players.find((p) => p.id === meId)?.isHost;
  const myTeam = members[meId];

  return (
    <section className="card team-picker">
      <div className="team-picker-head">
        <h2>
          {t('lobby.teams')}{' '}
          <span className="muted">
            ({room.players.length}/{room.settings.maxPlayers})
          </span>
        </h2>
        {viewerIsHost && (
          <button type="button" className="btn btn-secondary btn-small" onClick={() => socket.emit('team:shuffle')}>
            {t('lobby.shuffle')}
          </button>
        )}
      </div>
      <div className="team-columns">
        {TEAM_IDS.map((team) => {
          const list = room.players.filter((p) => members[p.id] === team);
          return (
            <div key={team} className={`team-column ${team}`}>
              <h3>{t(`team.${team}`)}</h3>
              <ul>
                {list.map((p) => (
                  <li key={p.id} className={p.connected ? '' : 'offline'}>
                    <AvatarBadge avatar={p.avatar} size={32} />
                    <span className="name">
                      {p.name}
                      {p.id === meId && <span className="muted"> {t('common.you')}</span>}
                    </span>
                    {p.isHost && <span title={t('common.host')}>👑</span>}
                    <PlayerActions viewerIsHost={viewerIsHost} viewerId={meId} targetId={p.id} targetName={p.name} />
                  </li>
                ))}
                {list.length < MIN_PER_TEAM && (
                  <li className="team-need muted small">{t('lobby.teamNeeds', { n: MIN_PER_TEAM })}</li>
                )}
              </ul>
              {myTeam !== team && (
                <button
                  type="button"
                  className="btn btn-ghost btn-small team-join"
                  onClick={() => socket.emit('team:join', team)}
                >
                  {t('lobby.joinTeam')}
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
