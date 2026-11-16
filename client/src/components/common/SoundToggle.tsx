import { useEffect, useState } from 'react';
import { isMuted, onMutedChange, play, setMuted } from '../../effects/sound';

export default function SoundToggle({ className = '' }: { className?: string }) {
  const [muted, setState] = useState(isMuted);
  useEffect(() => {
    const off = onMutedChange(setState);
    return () => {
      off();
    };
  }, []);

  return (
    <button
      type="button"
      className={`icon-btn sound-toggle ${className}`}
      title={muted ? 'Sesi aç' : 'Sesi kapat'}
      aria-label={muted ? 'Sesi aç' : 'Sesi kapat'}
      onClick={() => {
        setMuted(!muted);
        if (muted) play('pop');
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
