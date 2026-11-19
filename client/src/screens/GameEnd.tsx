import AvatarBadge from '../components/common/AvatarBadge';
import { useT } from '../i18n';
import { socket } from '../lib/socket';
import type { GameData } from '../types';

export default function GameEnd({ data }: { data: GameData }) {
  const t = useT();
  const { room, meId } = data;
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const podium = [ranked[1], ranked[0], ranked[2]]; // 2. - 1. - 3. sırası
  const isHost = room.players.find((p) => p.id === meId)?.isHost;
  const telephone = room.settings.mode === 'telephone';
  // Kırık Telefon'da puan yerine aldığı 😂 sayısı gösterilir.
  const unit = telephone ? '😂' : t('common.pointsUnit');

  const teams = room.settings.mode === 'teams' ? room.teams : null;
  const winnerTeam = teams
    ? teams.score.red === teams.score.blue
      ? null
      : teams.score.red > teams.score.blue
        ? 'red'
        : 'blue'
    : null;
  const myTeam = teams?.members[meId];

  return (
    <div className="end">
      <h1 className="logo small">{telephone ? t('end.comedian') : t('end.title')}</h1>
      {teams && (
        <div className={`card team-final${winnerTeam ? ` ${winnerTeam}` : ''}`}>
          <b>
            {winnerTeam
              ? `${t('end.teamWon', { team: t(`team.${winnerTeam}`) })}${winnerTeam === myTeam ? ' 🎉' : ''}`
              : t('end.draw')}
          </b>
          <span className="team-final-score">
            🔴 {teams.score.red} – {teams.score.blue} 🔵
          </span>
          <span className="muted small">{t('end.bestPlayers')}</span>
        </div>
      )}
      <div className="podium">
        {podium.map((p, i) =>
          p ? (
            <div key={p.id} className={`step step-${[2, 1, 3][i]}`}>
              <AvatarBadge avatar={p.avatar} size={[64, 84, 56][i]} />
              <b>{p.name}</b>
              <span>
                {p.score} {unit}
              </span>
              <div className="block">{['🥈', '🥇', '🥉'][i]}</div>
            </div>
          ) : (
            // biome-ignore lint/suspicious/noArrayIndexKey: boş basamağın kimliği yok, konumu sabit
            <div key={`bos${i}`} className="step" />
          ),
        )}
      </div>

      {ranked.length > 3 && (
        <ol className="card rest" start={4}>
          {ranked.slice(3).map((p) => (
            <li key={p.id}>
              <span>
                {p.avatar.face} {p.name}
              </span>
              <b>
                {p.score} {telephone ? unit : ''}
              </b>
            </li>
          ))}
        </ol>
      )}

      <div className="end-actions">
        {isHost ? (
          <button type="button" className="btn btn-primary btn-big" onClick={() => socket.emit('game:restart')}>
            {t('end.playAgain')}
          </button>
        ) : (
          <p className="waiting">{t('end.waitHost')}</p>
        )}
        <button type="button" className="btn btn-ghost" onClick={data.leave}>
          {t('end.home')}
        </button>
      </div>
    </div>
  );
}
