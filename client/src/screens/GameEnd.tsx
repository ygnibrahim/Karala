import AvatarBadge from '../components/common/AvatarBadge';
import { socket } from '../lib/socket';
import type { GameData } from '../types';

export default function GameEnd({ data }: { data: GameData }) {
  const { room, meId } = data;
  const ranked = [...room.players].sort((a, b) => b.score - a.score);
  const podium = [ranked[1], ranked[0], ranked[2]]; // 2. - 1. - 3. sırası
  const isHost = room.players.find((p) => p.id === meId)?.isHost;
  const telephone = room.settings.mode === 'telephone';
  // Kırık Telefon'da puan yerine aldığı 😂 sayısı gösterilir.
  const unit = telephone ? '😂' : 'puan';

  return (
    <div className="end">
      <h1 className="logo small">{telephone ? 'Günün Komedyeni 😂' : 'Oyun Bitti! 🏆'}</h1>
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
            🔁 Tekrar Oyna
          </button>
        ) : (
          <p className="waiting">Oda sahibi yeni oyunu başlatabilir…</p>
        )}
        <button type="button" className="btn btn-ghost" onClick={data.leave}>
          Ana menüye dön
        </button>
      </div>
    </div>
  );
}
