import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { messageText, useT } from '../../i18n';
import { useMuted } from '../../lib/muted';
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
  const t = useT();
  const muted = useMuted();
  const [text, setText] = useState('');
  const listRef = useRef<HTMLDivElement>(null);

  // Liste en altta kalsın: yeni mesaj gelince ve alan küçülünce (klavye açılınca) son mesaj görünür.
  // Kullanıcı eski mesajları okumak için yukarı kaydırdıysa yerinden oynatılmaz.
  const atBottom = useRef(true);
  const lastId = messages[messages.length - 1]?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: son mesaj değişince (yeni mesaj gelince) çalışmalı
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [lastId]);
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const onScroll = () => {
      atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
    };
    const ro = new ResizeObserver(() => {
      if (atBottom.current) el.scrollTop = el.scrollHeight;
    });
    el.addEventListener('scroll', onScroll, { passive: true });
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
    };
  }, []);

  const me = room.players.find((p) => p.id === meId);
  const drawing = room.phase === 'drawing';
  const insider = drawing && (room.drawerId === meId || !!me?.guessed);
  const placeholder = customPlaceholder ?? (!drawing ? t('chat.placeholder') : insider ? t('chat.insider') : t('chat.guess'));

  const send = () => {
    const t = text.trim();
    if (!t) return;
    socket.emit('chat:send', t);
    setText('');
  };

  return (
    <div className={`chat${compact ? ' compact' : ''}`}>
      <div className="chat-list" ref={listRef}>
        {messages
          .filter((m) => !m.from || !muted.has(m.from))
          .map((m) => (
            <div key={m.id} className={`msg msg-${m.kind}`}>
              {m.name && <b style={{ color: m.color }}>{m.name}: </b>}
              {messageText(m)}
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
        <button className="btn btn-primary" type="submit" aria-label={t('common.send')}>
          ➤
        </button>
      </form>
    </div>
  );
}
