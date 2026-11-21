// Oyun ekranı: üst bar, oyuncular, çizim tahtası ve sohbet.
import { useEffect } from 'react';
import Board from '../components/board/Board';
import Chat from '../components/game/Chat';
import PlayerList from '../components/game/PlayerList';
import { ReactionBar, ReactionLayer } from '../components/game/Reactions';
import TopBar from '../components/game/TopBar';
import TurnOverlay from '../components/game/TurnOverlay';
import WordArea from '../components/game/WordArea';
import { play } from '../effects/sound';
import { useCountdown } from '../hooks/useCountdown';
import { useT } from '../i18n';
import type { GameData } from '../types';

/** Bu saniyeden itibaren sayaç kırmızıya döner. */
const URGENT_SECONDS = 10;
/** Son kaç saniyede tik-tak sesi çalar. */
const TICK_SECONDS = 5;

export default function Game({ data }: { data: GameData }) {
  const t = useT();
  const { room, meId, secret, choices, stateAt } = data;

  const drawer = room.players.find((p) => p.id === room.drawerId);
  const me = room.players.find((p) => p.id === meId);
  const iAmDrawer = room.drawerId === meId;
  const drawing = room.phase === 'drawing';

  const { seconds, progress } = useCountdown(room, stateAt);

  useEffect(() => {
    if (drawing && seconds > 0 && seconds <= TICK_SECONDS) play(seconds <= 3 ? 'tickHigh' : 'tick');
  }, [seconds, drawing]);

  return (
    <div className="game">
      <TopBar
        title={t('common.round', { round: room.round, total: room.settings.rounds })}
        seconds={seconds}
        progress={progress}
        urgent={drawing && seconds <= URGENT_SECONDS}
        onLeave={data.leave}
      >
        <WordArea room={room} secret={secret} iAmDrawer={iAmDrawer} />
      </TopBar>

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
        {drawing && !iAmDrawer && <ReactionBar drawerName={drawer?.name} guessed={!!me?.guessed} />}
      </main>

      <section className="side-chat">
        <Chat data={data} compact />
      </section>
    </div>
  );
}
