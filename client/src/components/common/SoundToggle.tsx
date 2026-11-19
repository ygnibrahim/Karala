import { useEffect, useState } from 'react';
import { isMuted, onMutedChange, play, setMuted } from '../../effects/sound';
import { useT } from '../../i18n';

export default function SoundToggle({ className = '' }: { className?: string }) {
  const t = useT();
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
      title={muted ? t('common.soundOn') : t('common.soundOff')}
      aria-label={muted ? t('common.soundOn') : t('common.soundOff')}
      onClick={() => {
        setMuted(!muted);
        if (muted) play('pop');
      }}
    >
      {muted ? '🔇' : '🔊'}
    </button>
  );
}
