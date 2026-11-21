// Üst bardaki kelime alanı: aşamaya göre ipucu, gizli kelime ya da açıklanan kelime.
import type { RoomState } from '@shared';
import { useT } from '../../i18n';
import Hint from './Hint';

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
  return <Hint hint={room.hint} />;
}
