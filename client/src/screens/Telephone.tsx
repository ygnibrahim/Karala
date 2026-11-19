// Kırık Telefon oynama ekranı: adıma göre yaz, çiz ya da tahmin et; gönderince diğerlerini bekle.
import { type DrawOp, LIMITS, type RoomState, type TelephoneStepKind, type TelephoneTask } from '@shared';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import Board from '../components/board/Board';
import AvatarBadge from '../components/common/AvatarBadge';
import DrawingView from '../components/common/DrawingView';
import PlayerActions from '../components/common/PlayerActions';
import TopBar from '../components/game/TopBar';
import { play } from '../effects/sound';
import { useCountdown } from '../hooks/useCountdown';
import { type Key, useT } from '../i18n';
import { socket } from '../lib/socket';
import type { GameData } from '../types';

const STEP_TITLE: Record<TelephoneStepKind, Key> = {
  write: 'tp.write',
  draw: 'tp.draw',
  guess: 'tp.guess',
};

/** Süre bitmeden bu kadar önce yazılan metin kendiliğinden gönderilir. */
const AUTO_SUBMIT_MS = 1000;
/** "Bitirdim"den sonra son çizim noktalarının sunucuya ulaşması için kısa bekleme. */
const DRAW_FLUSH_MS = 150;

export default function Telephone({ data }: { data: GameData }) {
  const t = useT();
  const { room, meId, task, stateAt } = data;
  const tp = room.telephone;
  const { timeLeftMs, seconds, progress } = useCountdown(room, stateAt);
  const urgent = seconds <= 10;

  useEffect(() => {
    if (urgent && seconds > 0 && seconds <= 5 && task && !task.submitted) play(seconds <= 3 ? 'tickHigh' : 'tick');
  }, [seconds, urgent, task]);

  if (!tp) return null;
  const isParticipant = tp.participants.includes(meId);
  const done = !task || task.submitted || tp.submitted.includes(meId);

  return (
    <div className="tp">
      <TopBar
        title={t('tp.step', { step: tp.step + 1, total: tp.totalSteps })}
        seconds={seconds}
        progress={progress}
        urgent={urgent}
        onLeave={data.leave}
      >
        <span className="tp-title">{t(STEP_TITLE[tp.kind])}</span>
      </TopBar>

      <main className="tp-main">
        {!isParticipant ? (
          <div className="card tp-card center">
            <h2>{t('common.spectating')}</h2>
            <p className="muted">{t('tp.lateJoin')}</p>
          </div>
        ) : done || !task ? (
          <Waiting room={room} />
        ) : task.kind === 'draw' ? (
          <DrawStep key={task.step} task={task} />
        ) : (
          <TextStep key={task.step} task={task} timeLeftMs={timeLeftMs} />
        )}
      </main>

      <PlayerProgress room={room} meId={meId} />
    </div>
  );
}

function TextStep({ task, timeLeftMs }: { task: TelephoneTask; timeLeftMs: number }) {
  const t = useT();
  const [text, setText] = useState('');
  const sentRef = useRef(false);
  const drawing = task.prompt && 'drawing' in task.prompt ? task.prompt.drawing : null;

  const submit = (value: string) => {
    const clean = value.trim();
    if (!clean || sentRef.current) return;
    sentRef.current = true;
    socket.emit('tp:submit', task.step, clean);
    play('pop');
  };

  // Süre bitmek üzereyken yazılanı kaybetme.
  useEffect(() => {
    if (timeLeftMs > 0 && timeLeftMs <= AUTO_SUBMIT_MS) submit(text);
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(text);
  };

  return (
    <form className={`card tp-card${drawing ? ' with-drawing' : ''}`} onSubmit={onSubmit}>
      {drawing ? (
        <>
          <h2>{t('tp.whatIsIt')}</h2>
          <DrawingView drawing={drawing} className="tp-drawing" />
        </>
      ) : (
        <>
          <h2>{t('tp.writePrompt')}</h2>
          <p className="muted small">{t('tp.writeHint')}</p>
        </>
      )}
      <div className="tp-input-row">
        <input
          className="input"
          value={text}
          maxLength={LIMITS.chatLength}
          placeholder={drawing ? t('tp.guessPlaceholder') : t('tp.writePlaceholder')}
          autoComplete="off"
          enterKeyHint="send"
          onChange={(e) => setText(e.target.value)}
        />
        {!drawing && task.suggestion && (
          <button
            type="button"
            className="icon-btn"
            title={t('tp.suggestion')}
            aria-label={t('tp.randomSuggestion')}
            onClick={() => setText(task.suggestion ?? '')}
          >
            🎲
          </button>
        )}
      </div>
      <button type="submit" className="btn btn-primary btn-big" disabled={!text.trim()}>
        {t('tp.submit')}
      </button>
    </form>
  );
}

function DrawStep({ task }: { task: TelephoneTask }) {
  const t = useT();
  const [sending, setSending] = useState(false);
  const prompt = task.prompt && 'text' in task.prompt ? task.prompt.text : '';
  const sendOp = (op: DrawOp) => socket.emit('tp:draw', task.step, op);

  const finish = () => {
    setSending(true);
    setTimeout(() => socket.emit('tp:submit', task.step), DRAW_FLUSH_MS);
    play('pop');
  };

  return (
    <div className="tp-draw">
      <div className="tp-prompt">
        {t('tp.drawPrompt')} <strong>{prompt}</strong>
      </div>
      <Board canDraw={!sending} onOp={sendOp} />
      <button type="button" className="btn btn-primary btn-big" disabled={sending} onClick={finish}>
        {t('tp.done')}
      </button>
    </div>
  );
}

function Waiting({ room }: { room: RoomState }) {
  const t = useT();
  const tp = room.telephone;
  if (!tp) return null;
  return (
    <div className="card tp-card center">
      <h2>{t('tp.sent')}</h2>
      <p className="muted">{t('tp.waiting', { n: tp.submitted.length, total: tp.participants.length })}</p>
      <div className="tp-dots" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </div>
  );
}

function PlayerProgress({ room, meId }: { room: RoomState; meId: string }) {
  const t = useT();
  const tp = room.telephone;
  const viewerIsHost = !!room.players.find((p) => p.id === meId)?.isHost;
  if (!tp) return null;
  return (
    <ul className="tp-players">
      {tp.participants.map((id) => {
        const p = room.players.find((x) => x.id === id);
        if (!p) return null;
        const finished = tp.submitted.includes(id);
        return (
          <li key={id} className={`${finished ? 'done' : ''}${p.connected ? '' : ' offline'}${id === meId ? ' me' : ''}`}>
            <AvatarBadge avatar={p.avatar} size={32} />
            <span className="name">{p.name}</span>
            <span role="img" aria-label={finished ? t('tp.finished') : t('tp.thinking')}>
              {finished ? '✅' : '✏️'}
            </span>
            <PlayerActions viewerIsHost={viewerIsHost} viewerId={meId} targetId={id} targetName={p.name} />
          </li>
        );
      })}
    </ul>
  );
}
