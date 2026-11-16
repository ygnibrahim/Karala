// Açık odaların listesi: oda kurma, bulma ve boşalınca silme.
import { LIMITS } from '@shared';
import { SERVER_LIMITS } from '../config';
import { makeRoomCode } from '../utils/random';
import { type IO, Room } from './Room';

export class RoomManager {
  private rooms = new Map<string, Room>();

  constructor(private readonly io: IO) {}

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  /** Yeni oda kurar; sunucu doluysa null döner. */
  create(): Room | null {
    if (this.rooms.size >= SERVER_LIMITS.maxRooms) return null;
    const code = makeRoomCode(LIMITS.roomCodeLength, (c) => this.rooms.has(c));
    const room = new Room(this.io, code, (r) => this.rooms.delete(r.code));
    this.rooms.set(code, room);
    return room;
  }

  /** Kurulup hiç kimsenin girmediği odayı siler. */
  discard(room: Room): void {
    if (room.players.length === 0) {
      room.dispose();
      this.rooms.delete(room.code);
    }
  }

  /** Tüm odaları kapatır (testlerde ve sunucu kapanırken). */
  closeAll(): void {
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
  }
}
