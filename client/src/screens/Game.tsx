// Oyun ekranı: üst bar, oyuncular, çizim tahtası ve sohbet.
import { useEffect } from 'react';
import Board from '../components/board/Board';
import SoundToggle from '../components/common/SoundToggle';
import Chat from '../components/game/Chat';
import PlayerList from '../components/game/PlayerList';
import { ReactionBar, ReactionLayer } from '../components/game/Reactions';
import TurnOverlay from '../components/game/TurnOverlay';
import WordArea from '../components/game/WordArea';
import { play } from '../effects/sound';
import { useNow } from '../hooks/useNow';
import type { GameData } from '../types';

/** Bu saniyeden itibaren sayaç kırmızıya döner. */
const URGENT_SECONDS = 10;
/** Son kaç saniyede tik-tak sesi çalar. */
const TICK_SECONDS = 5;

export default function Game({ data }: { data: GameData }) {
  const { room, meId, secret, choices, stateAt } = data;
  const now = useNow(250);

  const drawer = room.players.find((p) => p.id === room.drawerId);
  const me = room.players.find((p) => p.id === meId);
  const iAmDrawer = room.drawerId === meId;
  const drawing = room.phase === 'drawing';

  const timeLeft = room.timeLeftMs === null ? 0 : Math.max(0, room.timeLeftMs - (now - stateAt));
  const seconds = Math.ceil(timeLeft / 1000);
  const progress = room.phaseDurationMs ? timeLeft / room.phaseDurationMs : 0;

  useEffect(() => {
    if (drawing && seconds > 0 && seconds <= TICK_SECONDS) play(seconds <= 3 ? 'tickHigh' : 'tick');
  }, [seconds, drawing]);

  const confirmLeave = () => {
    if (confirm('Oyundan çıkmak istiyor musun?')) data.leave();
  };

  return (
    <div className="game">
      <header className="topbar">
        <div className="round">
          <button type="button" className="icon-btn small" onClick={confirmLeave} title="Çık" aria-label="Oyundan çık">
            ✕
          </button>
          <span>
            Tur {room.round}/{room.settings.rounds}
          </span>
        </div>
        <div className="word-area">
          <WordArea room={room} secret={secret} iAmDrawer={iAmDrawer} />
        </div>
        <div className="top-right">
          <SoundToggle className="small" />
          <div className={`timer${drawing && seconds <= URGENT_SECONDS ? ' urgent' : ''}`}>⏱ {seconds}</div>
        </div>
        <div className="progress">
          <span style={{ width: `${progress * 100}%` }} />
        </div>
      </header>

      <aside className="side-players">
        <PlayerList room={room} meId={meId} />
      </aside>

      <main className="main-board">
        <Board
          canDraw={iAmDrawer && drawing}
          overlay={
            room.phase === 'choosing' || room.phase === 'turnEnd' ? (
              <TurnOverlay room={room} iAmDrawer={iAmDrawer} choices={choices} seconds={seconds} />
            ) : undefined
          }
        />
        <ReactionLayer />
        {drawing && !iAmDrawer && (
          <ReactionBar drawerName={drawer?.name} guessed={!!me?.guessed} turnKey={`${room.round}-${room.drawerId}`} />
        )}
      </main>

      <section className="side-chat">
        <Chat data={data} compact />
      </section>
    </div>
  );
}
