// Üst bardaki kelime alanı: aşamaya göre ipucu, gizli kelime ya da açıklanan kelime.
import type { RoomState } from '@shared';
import { useT } from '../../i18n';

interface Props {
  room: RoomState;
  secret: string | null;
  iAmDrawer: boolean;
}

export default function WordArea({ room, secret, iAmDrawer }: Props) {
  const t = useT();
  if (room.phase === 'choosing') return <span className="muted">{t('game.choosingWord')}</span>;
  if (room.phase === 'turnEnd') return <span className="word-reveal">{room.turnResult?.word || '—'}</span>;

  if (secret) {
    return (
      <span className={`word-secret${iAmDrawer ? '' : ' guessed'}`}>
        {iAmDrawer ? t('game.drawThis', { word: secret }) : `✅ ${secret}`}
      </span>
    );
  }

  if (!room.hint) return null;
  const letterCount = room.hint.filter((c) => c !== ' ').length;
  return (
    <span className="hint">
      {room.hint.map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: harfin konumu kimliğidir; açılan harf animasyonu buna dayanır
        <span key={i} className={c === ' ' ? 'gap' : c === '_' ? 'blank' : 'letter'}>
          {c === '_' ? '' : c}
        </span>
      ))}
      <sup>{letterCount}</sup>
    </span>
  );
}
