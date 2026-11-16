// Tepkiler: tahmin edenlerin 👍/👎 butonları ve tuvalin üstünde uçuşan emojiler.
import type { ReactionKind } from '@shared';
import { useEffect, useState } from 'react';
import { play } from '../../effects/sound';
import { socket } from '../../lib/socket';

const EMOJI: Record<ReactionKind, string> = { like: '👍', dislike: '👎' };
/** Uçan emojinin ekranda kalma süresi (CSS animasyonuyla aynı). */
const FLOAT_MS = 2200;

interface Floater {
  id: number;
  emoji: string;
  name: string;
  left: number;
}

let nextId = 0;

/** Odadaki herkesin tepkilerini tuvalin üstünde uçurur. */
export function ReactionLayer() {
  const [floaters, setFloaters] = useState<Floater[]>([]);

  useEffect(() => {
    const onReaction = ({ kind, name }: { kind: ReactionKind; name: string }) => {
      const f = { id: ++nextId, emoji: EMOJI[kind], name, left: 10 + Math.random() * 80 };
      setFloaters((list) => [...list, f]);
      setTimeout(() => setFloaters((list) => list.filter((x) => x.id !== f.id)), FLOAT_MS);
      play('pop');
    };
    socket.on('reaction', onReaction);
    return () => {
      socket.off('reaction', onReaction);
    };
  }, []);

  return (
    <div className="floaters" aria-hidden="true">
      {floaters.map((f) => (
        <span key={f.id} className="floater" style={{ left: `${f.left}%` }}>
          {f.emoji}
          <small>{f.name}</small>
        </span>
      ))}
    </div>
  );
}

interface BarProps {
  drawerName: string | undefined;
  guessed: boolean;
  /** Tur değişince butonlar yeniden açılsın diye turun kimliği. */
  turnKey: string;
}

/** Tahmin edenlerin tepki butonları (tur başına bir kez). */
export function ReactionBar({ drawerName, guessed, turnKey }: BarProps) {
  const [reactedTurn, setReactedTurn] = useState<string | null>(null);

  return (
    <div className="react-row">
      <span className="muted small">
        {drawerName} çiziyor{guessed ? ' · sen bildin!' : ''}
      </span>
      <span className="react-btns">
        {(['like', 'dislike'] as const).map((kind) => (
          <button
            type="button"
            key={kind}
            className="icon-btn"
            aria-label={kind === 'like' ? 'Beğendim' : 'Beğenmedim'}
            disabled={reactedTurn === turnKey}
            onClick={() => {
              socket.emit('react', kind);
              setReactedTurn(turnKey);
            }}
          >
            {EMOJI[kind]}
          </button>
        ))}
      </span>
    </div>
  );
}
