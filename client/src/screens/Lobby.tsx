// Lobi: oyuncular toplanır, oda sahibi ayarları yapıp oyunu başlatır.
import { useEffect, useRef, useState } from 'react';
import SoundToggle from '../components/common/SoundToggle';
import Chat from '../components/game/Chat';
import LobbyPlayers from '../components/lobby/LobbyPlayers';
import QrInvite from '../components/lobby/QrInvite';
import SettingsPanel from '../components/lobby/SettingsPanel';
import TeamPicker, { teamsReady } from '../components/lobby/TeamPicker';
import { useT } from '../i18n';
import { loadCustomWords } from '../lib/customWords';
import { inviteLink } from '../lib/session';
import { socket } from '../lib/socket';
import type { GameData } from '../types';

export default function Lobby({ data }: { data: GameData }) {
  const t = useT();
  const { room, meId } = data;
  const isHost = !!room.players.find((p) => p.id === meId)?.isHost;
  const connectedCount = room.players.filter((p) => p.connected).length;
  const teamMode = room.settings.mode === 'teams';
  const [copied, setCopied] = useState(false);

  // Oda sahibinin bu cihazda kayıtlı özel kelimeleri varsa yeni odaya bir kez otomatik eklenir.
  const restored = useRef(false);
  useEffect(() => {
    if (!isHost || restored.current) return;
    restored.current = true;
    const saved = loadCustomWords();
    if (saved.length && room.settings.customWordCount === 0) socket.emit('room:settings', { customWords: saved });
  }, [isHost, room.settings.customWordCount]);

  const shareInvite = async () => {
    const link = inviteLink(room.code);
    try {
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ title: 'Karala', text: t('lobby.shareText'), url: link });
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
          {t('lobby.leave')}
        </button>
        <div className="room-code">
          <span className="muted small">{t('lobby.roomCode')}</span>
          <strong>{room.code}</strong>
        </div>
        <div className="head-actions">
          <SoundToggle />
          <QrInvite code={room.code} />
          <button type="button" className="btn btn-secondary btn-small" onClick={shareInvite}>
            {copied ? t('lobby.copied') : t('lobby.invite')}
          </button>
        </div>
      </header>

      <div className="lobby-grid">
        {teamMode ? <TeamPicker room={room} meId={meId} /> : <LobbyPlayers room={room} meId={meId} />}
        <SettingsPanel
          settings={room.settings}
          isHost={isHost}
          customWords={data.customWords}
          connectedCount={connectedCount}
          teamsReady={!teamMode || teamsReady(room)}
        />
        <section className="card lobby-chat">
          <Chat data={data} />
        </section>
      </div>
    </div>
  );
}
