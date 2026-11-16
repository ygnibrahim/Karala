import type { ChatMessage, RoomState } from '@shared';
import { celebrate, confetti } from './confetti';
import { play, vibrate } from './sound';

const revealedCount = (hint: string[] | null) => hint?.filter((c) => c !== '_' && c !== ' ').length ?? 0;

/**
 * Art arda gelen iki oda durumunu karşılaştırıp uygun ses/animasyonu tetikler.
 * Socket olayında doğrudan çağrılır: React birden fazla güncellemeyi birleştirse de ara anlar kaçmaz.
 */
export function stateFx(p: RoomState | null, room: RoomState, meId: string) {
  if (!p || p.code !== room.code) return;

  const meNow = room.players.find((x) => x.id === meId);
  const meBefore = p.players.find((x) => x.id === meId);
  const iJustGuessed = !!meNow?.guessed && !meBefore?.guessed && room.drawerId !== meId;
  if (iJustGuessed) {
    play('correct');
    confetti({ x: 0.5, y: 0.35, count: 90, spread: 120, power: 13 });
    vibrate(90);
  }

  if (room.phase !== p.phase) {
    switch (room.phase) {
      case 'choosing':
        if (room.drawerId === meId) {
          play('yourTurn');
          vibrate([60, 40, 60]);
        } else play('turnStart');
        break;
      case 'drawing':
        play('drawStart');
        break;
      case 'turnEnd':
        if (!iJustGuessed) play(room.turnResult?.reason === 'allGuessed' ? 'allGuessed' : 'timeUp');
        break;
      case 'gameEnd':
        play('victory');
        celebrate();
        vibrate([100, 50, 100, 50, 220]);
        break;
    }
    return;
  }

  if (room.phase === 'lobby') {
    if (room.players.length > p.players.length) play('join');
    else if (room.players.length < p.players.length) play('leave');
    return;
  }

  if (room.phase === 'drawing') {
    const someoneElseGuessed = room.players.some(
      (x) => x.id !== meId && x.guessed && !p.players.find((y) => y.id === x.id)?.guessed,
    );
    if (someoneElseGuessed && !iJustGuessed) play('otherCorrect');
    if (revealedCount(room.hint) > revealedCount(p.hint)) play('hint');
  }
}

export function messageFx(m: ChatMessage) {
  if (m.kind === 'close') {
    play('close');
    vibrate(30);
  } else if (m.kind === 'chat' || m.kind === 'insider') {
    play('message');
  }
}
