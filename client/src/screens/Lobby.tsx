// Lobi: oyuncular toplanır, oda sahibi ayarları yapıp oyunu başlatır.
import { useState } from 'react';
import SoundToggle from '../components/common/SoundToggle';
import Chat from '../components/game/Chat';
import LobbyPlayers from '../components/lobby/LobbyPlayers';
import SettingsPanel from '../components/lobby/SettingsPanel';
import { inviteLink } from '../lib/session';
import type { GameData } from '../types';

export default function Lobby({ data }: { data: GameData }) {
  const { room, meId } = data;
  const isHost = !!room.players.find((p) => p.id === meId)?.isHost;
  const connectedCount = room.players.filter((p) => p.connected).length;
  const [copied, setCopied] = useState(false);

  const shareInvite = async () => {
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
      /* kullanıcı paylaşmaktan vazgeçti */
    }
  };

  return (
    <div className="lobby">
      <header className="lobby-head">
        <button type="button" className="btn btn-ghost btn-small" onClick={data.leave}>
          ← Çık
        </button>
        <div className="room-code">
          <span className="muted small">Oda kodu</span>
          <strong>{room.code}</strong>
        </div>
        <div className="head-actions">
          <SoundToggle />
          <button type="button" className="btn btn-secondary btn-small" onClick={shareInvite}>
            {copied ? '✓ Kopyalandı' : '🔗 Davet et'}
          </button>
        </div>
      </header>

      <div className="lobby-grid">
        <LobbyPlayers room={room} meId={meId} />
        <SettingsPanel settings={room.settings} isHost={isHost} customWords={data.customWords} connectedCount={connectedCount} />
        <section className="card lobby-chat">
          <Chat data={data} />
        </section>
      </div>
    </div>
  );
}
