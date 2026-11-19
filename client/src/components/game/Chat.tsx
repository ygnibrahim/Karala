import { useEffect, useRef, useState } from 'react';
import { socket } from '../../lib/socket';
import type { GameData } from '../../types';

interface Props {
  data: GameData;
  compact?: boolean;
  /** Ekranın kendi ipucu metni (ör. takım modunda "sadece takımın görür"). */
  placeholder?: string;
}

export default function Chat({ data, compact = false, placeholder: customPlaceholder }: Props) {
  const { room, meId, messages } = data;
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, []);

  const me = room.players.find((p) => p.id === meId);
  const drawing = room.phase === 'drawing';
  const insider = drawing && (room.drawerId === meId || !!me?.guessed);
  const placeholder = customPlaceholder ?? (!drawing ? 'Mesaj yaz…' : insider ? 'Sadece bilenler görür…' : 'Tahminini yaz…');

  const send = () => {
    const t = text.trim();
    if (!t) return;
    socket.emit('chat:send', t);
    setText('');
  };

  return (
    <div className={`chat${compact ? ' compact' : ''}`}>
      <div className="chat-list" ref={listRef}>
        {messages.map((m) => (
          <div key={m.id} className={`msg msg-${m.kind}`}>
            {m.name && <b style={{ color: m.color }}>{m.name}: </b>}
            {m.text}
          </div>
        ))}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <input
          className={`input${insider ? ' insider' : ''}`}
          value={text}
          maxLength={100}
          placeholder={placeholder}
          enterKeyHint="send"
          autoComplete="off"
          autoCorrect="off"
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn btn-primary" type="submit" aria-label="Gönder">
          ➤
        </button>
      </form>
    </div>
  );
}
