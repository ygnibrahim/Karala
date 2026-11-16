import type { GameData } from '../App';
import AvatarBadge from '../components/AvatarBadge';
import { socket } from '../socket';

export default function GameEnd({ data }: { data: GameData }) {
  const { room, meId } = data;
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const podium = [ranked[1], ranked[0], ranked[2]]; // 2. - 1. - 3. sırası
  const isHost = room.players.find((p) => p.id === meId)?.isHost;

  return (
    <div className="end">
      <h1 className="logo small">Oyun Bitti! 🏆</h1>
      <div className="podium">
        {podium.map((p, i) =>
          p ? (
            <div key={p.id} className={'step step-' + [2, 1, 3][i]}>
              <AvatarBadge avatar={p.avatar} size={[64, 84, 56][i]} />
              <b>{p.name}</b>
              <span>{p.score} puan</span>
              <div className="block">{['🥈', '🥇', '🥉'][i]}</div>
            </div>
          ) : (
            <div key={'bos' + i} className="step" />
          ),
        )}
      </div>

      {ranked.length > 3 && (
        <ol className="card rest" start={4}>
          {ranked.slice(3).map((p) => (
            <li key={p.id}>
              <span>{p.avatar.face} {p.name}</span>
              <b>{p.score}</b>
            </li>
          ))}
        </ol>
      )}

      <div className="end-actions">
        {isHost ? (
          <button className="btn btn-primary btn-big" onClick={() => socket.emit('game:restart')}>🔁 Tekrar Oyna</button>
        ) : (
          <p className="waiting">Oda sahibi yeni oyunu başlatabilir…</p>
        )}
        <button className="btn btn-ghost" onClick={data.leave}>Ana menüye dön</button>
      </div>
    </div>
  );
}
