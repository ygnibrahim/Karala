// Oyun ekranlarının üst barı: sol başlık, ortada içerik, sağda ses ve sayaç, altta zaman çubuğu.
import type { ReactNode } from 'react';
import SoundToggle from '../common/SoundToggle';

interface Props {
  title: ReactNode;
  children?: ReactNode;
  /** Gösterilecek saniye; null ise sayaç gizlenir. */
  seconds: number | null;
  /** 0..1 arası kalan süre oranı. */
  progress: number;
  urgent?: boolean;
  onLeave: () => void;
}

export default function TopBar({ title, children, seconds, progress, urgent = false, onLeave }: Props) {
  const confirmLeave = () => {
    if (confirm('Oyundan çıkmak istiyor musun?')) onLeave();
  };

  return (
    <header className="topbar">
      <div className="round">
        <button type="button" className="icon-btn small" onClick={confirmLeave} title="Çık" aria-label="Oyundan çık">
          ✕
        </button>
        <span>{title}</span>
      </div>
      <div className="word-area">{children}</div>
      <div className="top-right">
        <SoundToggle className="small" />
        {seconds !== null && <div className={`timer${urgent ? ' urgent' : ''}`}>⏱ {seconds}</div>}
      </div>
      <div className="progress">
        <span style={{ width: `${progress * 100}%` }} />
      </div>
    </header>
  );
}
