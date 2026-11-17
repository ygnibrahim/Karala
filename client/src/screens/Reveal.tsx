// Kırık Telefon gösterimi: zincirler adım adım açılır, herkes gülebilir, oda sahibi ilerletir.
import { useEffect, useRef, useState } from 'react';
import DrawingView from '../components/common/DrawingView';
import TopBar from '../components/game/TopBar';
import { play } from '../effects/sound';
import { socket } from '../lib/socket';
import type { GameData } from '../types';

export default function Reveal({ data }: { data: GameData }) {
  const { room, meId, reveal } = data;
  const info = room.telephone?.reveal;
  const listRef = useRef<HTMLOListElement>(null);
  const [laughedAt, setLaughedAt] = useState<Set<string>>(new Set());
  const isHost = !!room.players.find((p) => p.id === meId)?.isHost;

  const entries = reveal?.entries ?? [];
  const latest = entries.at(-1);
  const entryKey = info ? `${info.chain}:${info.entry}` : '';

  // Yeni adım açılınca ses çal ve en alta kaydır.
  useEffect(() => {
    if (!entryKey) return;
    play('pop');
    listRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [entryKey]);

  if (!info || !reveal) {
    return (
      <div className="tp">
        <main className="tp-main">
          <div className="card tp-card center">
            <h2>📞 Zincirler hazırlanıyor…</h2>
          </div>
        </main>
      </div>
    );
  }

  const lastEntryOfChain = info.entry >= info.chainLength - 1;
  const lastChain = info.chain >= info.totalChains - 1;
  const nextLabel = !lastEntryOfChain ? 'Sonraki ▶' : lastChain ? 'Sonuçlar 🏆' : 'Sonraki zincir ▶';
  const canLaugh = latest && latest.authorId !== meId && !laughedAt.has(entryKey);

  const laugh = () => {
    socket.emit('tp:laugh');
    setLaughedAt((s) => new Set(s).add(entryKey));
    play('pop');
  };

  return (
    <div className="tp">
      <TopBar title={`Zincir ${info.chain + 1}/${info.totalChains}`} seconds={null} progress={0} onLeave={data.leave}>
        <span className="tp-title">📞 {reveal.ownerName} başlattı</span>
      </TopBar>

      <main className="tp-main">
        <ol className="reveal-list" ref={listRef}>
          {entries.map((e, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: zincir adımları sadece sona eklenir, sıra değişmez
            <li key={`${reveal.chain}-${i}`} className={`reveal-item ${e.kind}`}>
              <span className="reveal-author">
                {i === 0 ? '✍️' : e.kind === 'drawing' ? '🎨' : '🤔'} {e.authorName}
              </span>
              {e.kind === 'text' ? (
                <p className="reveal-text">“{e.text}”</p>
              ) : (
                <DrawingView drawing={e.drawing ?? []} className="reveal-drawing" />
              )}
            </li>
          ))}
        </ol>
      </main>

      <footer className="reveal-actions">
        <button type="button" className="btn btn-secondary" disabled={!canLaugh} onClick={laugh}>
          😂 Güldüm
        </button>
        {isHost ? (
          <button type="button" className="btn btn-primary" onClick={() => socket.emit('tp:next')}>
            {nextLabel}
          </button>
        ) : (
          <span className="muted small">Oda sahibi ilerletiyor…</span>
        )}
      </footer>
    </div>
  );
}
