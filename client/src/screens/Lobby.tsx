import { useEffect, useState } from 'react';
import { CATEGORIES, DRAW_TIME_OPTIONS, MAX_PLAYER_OPTIONS, ROUND_OPTIONS, type Settings } from '../../../shared/protocol';
import type { GameData } from '../App';
import AvatarBadge from '../components/AvatarBadge';
import Chat from '../components/Chat';
import SoundToggle from '../components/SoundToggle';
import { socket } from '../socket';
import { inviteLink } from '../session';

export default function Lobby({ data }: { data: GameData }) {
  const { room, meId } = data;
  const me = room.players.find((p) => p.id === meId);
  const isHost = !!me?.isHost;
  const s = room.settings;
  const [copied, setCopied] = useState(false);
  const [wordsText, setWordsText] = useState(s.customWords.join(', '));

  // Oda sahibi değilsek sunucudaki kelime listesini göster.
  useEffect(() => {
    if (!isHost) setWordsText(s.customWords.join(', '));
  }, [isHost, s.customWords]);

  const update = (patch: Partial<Settings>) => socket.emit('room:settings', patch);

  const copyLink = async () => {
    const link = inviteLink(room.code);
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'Karala', text: 'Gel birlikte çizelim!', url: link });
      } else {
        await navigator.clipboard.writeText(link);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      /* kullanıcı iptal etti */
    }
  };

  const connectedCount = room.players.filter((p) => p.connected).length;
  const customCount = s.customWords.length;
  const canStart = connectedCount >= 2 && (s.category !== 'ozel' || customCount >= 3);

  return (
    <div className="lobby">
      <header className="lobby-head">
        <button className="btn btn-ghost btn-small" onClick={data.leave}>← Çık</button>
        <div className="room-code">
          <span className="muted small">Oda kodu</span>
          <strong>{room.code}</strong>
        </div>
        <div className="head-actions">
          <SoundToggle />
          <button className="btn btn-secondary btn-small" onClick={copyLink}>
            {copied ? '✓ Kopyalandı' : '🔗 Davet et'}
          </button>
        </div>
      </header>

      <div className="lobby-grid">
        <section className="card">
          <h2>Oyuncular <span className="muted">({room.players.length}/{s.maxPlayers})</span></h2>
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
            {Array.from({ length: Math.max(0, Math.min(3, s.maxPlayers - room.players.length)) }, (_, i) => (
              <li key={'bos' + i} className="empty-slot">
                <span className="avatar empty">?</span>
                <span className="muted">Bekleniyor…</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Ayarlar {!isHost && <span className="muted small">(oda sahibi değiştirebilir)</span>}</h2>
          <div className="settings">
            <label>
              Tur sayısı
              <select disabled={!isHost} value={s.rounds} onChange={(e) => update({ rounds: +e.target.value })}>
                {ROUND_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label>
              Çizim süresi
              <select disabled={!isHost} value={s.drawTime} onChange={(e) => update({ drawTime: +e.target.value })}>
                {DRAW_TIME_OPTIONS.map((n) => <option key={n} value={n}>{n} sn</option>)}
              </select>
            </label>
            <label>
              Kategori
              <select disabled={!isHost} value={s.category} onChange={(e) => update({ category: e.target.value })}>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label>
              En fazla oyuncu
              <select disabled={!isHost} value={s.maxPlayers} onChange={(e) => update({ maxPlayers: +e.target.value })}>
                {MAX_PLAYER_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="wide">
              Özel kelimeler <span className="muted small">(virgülle ayır · {customCount} kelime)</span>
              <textarea
                disabled={!isHost}
                rows={3}
                placeholder="ör. Ahmet'in arabası, kampüs kantini, yaz tatili"
                value={wordsText}
                onChange={(e) => setWordsText(e.target.value)}
                onBlur={() => update({ customWords: wordsText.split(/[,\n]/) })}
              />
            </label>
          </div>

          {isHost ? (
            <button className="btn btn-primary btn-big" disabled={!canStart} onClick={() => socket.emit('game:start')}>
              ▶ Oyunu Başlat
            </button>
          ) : (
            <p className="waiting">Oda sahibinin oyunu başlatması bekleniyor…</p>
          )}
          {isHost && connectedCount < 2 && <p className="muted small center">Başlamak için en az 2 oyuncu gerekli. Davet linkini paylaş!</p>}
          {isHost && s.category === 'ozel' && customCount < 3 && <p className="muted small center">Sadece özel kelimelerle oynamak için en az 3 kelime ekle.</p>}
        </section>

        <section className="card lobby-chat">
          <Chat data={data} />
        </section>
      </div>
    </div>
  );
}
