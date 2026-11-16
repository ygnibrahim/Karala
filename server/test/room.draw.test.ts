// Room.draw kuralları: reddedilen çizgi başlangıcından sonra gelen noktalar önceki çizgiye eklenmemeli.
import type { DrawOp } from '@shared';
import { describe, expect, it } from 'vitest';
import { SERVER_LIMITS } from '../src/config';
import { type GameSocket, type IO, Room } from '../src/game/Room';

function setup() {
  const relayed: DrawOp[] = [];
  const socket = { to: () => ({ emit: (_e: string, op: DrawOp) => relayed.push(op) }) } as unknown as GameSocket;
  const io = { to: () => ({ emit: () => {} }) } as unknown as IO;
  const room = new Room(io, 'TESTA', () => {});
  room.phase = 'drawing';
  room.drawerId = 'cizen';
  return { room, socket, relayed };
}

const start: DrawOp = { t: 'start', color: '#000000', size: 4, x: 1, y: 1 };
const move: DrawOp = { t: 'move', pts: [2, 2] };

describe('Room.draw', () => {
  it('normal çizgiyi kabul eder ve iletir', () => {
    const { room, socket, relayed } = setup();
    expect(room.draw(socket, 'cizen', start)).toBe(true);
    expect(room.draw(socket, 'cizen', move)).toBe(true);
    expect(relayed).toEqual([start, move]);
  });

  it('çizen olmayanın çizimini reddeder', () => {
    const { room, socket, relayed } = setup();
    expect(room.draw(socket, 'baskasi', start)).toBe(false);
    expect(relayed).toHaveLength(0);
  });

  it('başlangıcı reddedilen çizginin noktalarını iletmez (istek sınırı)', () => {
    const { room, socket, relayed } = setup();
    room.draw(socket, 'cizen', start);
    room.rejectDraw(); // ikinci çizginin başlangıcı istek sınırına takıldı
    expect(room.draw(socket, 'cizen', move)).toBe(false);
    expect(relayed).toEqual([start]);
  });

  it('başlangıcı reddedilen çizginin noktalarını iletmez (geçmiş dolu)', () => {
    const { room, socket, relayed } = setup();
    for (let i = 0; i < SERVER_LIMITS.maxHistoryItems; i++)
      room.draw(socket, 'cizen', { t: 'fill', color: '#ffffff', x: 0, y: 0 });
    relayed.length = 0;
    expect(room.draw(socket, 'cizen', start)).toBe(false);
    expect(room.draw(socket, 'cizen', move)).toBe(false);
    expect(relayed).toHaveLength(0);
  });

  it('şekil ya da boya kovasından sonra gelen noktalar eski çizgiye eklenmez', () => {
    const { room, socket, relayed } = setup();
    room.draw(socket, 'cizen', start);
    room.draw(socket, 'cizen', { t: 'fill', color: '#ff0000', x: 5, y: 5 });
    expect(room.draw(socket, 'cizen', move)).toBe(false);
    expect(relayed.map((o) => o.t)).toEqual(['start', 'fill']);
  });
});
