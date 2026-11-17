import type { RoomState } from '@shared';
import { useNow } from './useNow';

/** Sunucunun bildirdiği kalan süreden yerel geri sayım (saniye ve 0..1 oran). */
export function useCountdown(room: RoomState, stateAt: number): { timeLeftMs: number; seconds: number; progress: number } {
  const now = useNow(250);
  const timeLeftMs = room.timeLeftMs === null ? 0 : Math.max(0, room.timeLeftMs - (now - stateAt));
  return {
    timeLeftMs,
    seconds: Math.ceil(timeLeftMs / 1000),
    progress: room.phaseDurationMs ? timeLeftMs / room.phaseDurationMs : 0,
  };
}
