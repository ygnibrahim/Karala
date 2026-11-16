// Sunucu ve istemcinin ortak kullandığı tipler ve yardımcılar.

export type Phase = 'lobby' | 'choosing' | 'drawing' | 'turnEnd' | 'gameEnd';

export interface Avatar {
  color: string;
  face: string;
}

export const AVATAR_COLORS = [
  '#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#38d9a9',
  '#4dabf7', '#748ffc', '#b197fc', '#f783ac', '#adb5bd',
];
export const AVATAR_FACES = ['😀', '😎', '🤓', '🥳', '😺', '🐶', '🦊', '🐸', '🐼', '🤖', '👻', '🦄', '🐵', '🐙', '🦁', '🐧'];

export interface PublicPlayer {
  id: string;
  name: string;
  avatar: Avatar;
  score: number;
  guessed: boolean;
  connected: boolean;
  isHost: boolean;
}

export interface Settings {
  rounds: number;
  drawTime: number;
  category: string;
  customWords: string[];
  maxPlayers: number;
}

export const DEFAULT_SETTINGS: Settings = {
  rounds: 3,
  drawTime: 80,
  category: 'karisik',
  customWords: [],
  maxPlayers: 8,
};

export const ROUND_OPTIONS = [2, 3, 4, 5, 6, 8, 10];
export const DRAW_TIME_OPTIONS = [45, 60, 80, 100, 120, 150];
export const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

export const CATEGORIES: { id: string; name: string }[] = [
  { id: 'karisik', name: 'Karışık' },
  { id: 'hayvanlar', name: 'Hayvanlar' },
  { id: 'yiyecekler', name: 'Yiyecek & İçecek' },
  { id: 'esyalar', name: 'Eşyalar' },
  { id: 'meslekler', name: 'Meslekler' },
  { id: 'yerler', name: 'Yerler & Doğa' },
  { id: 'eylemler', name: 'Eylemler' },
  { id: 'ozel', name: 'Sadece özel kelimeler' },
];

export interface TurnResult {
  word: string;
  drawerId: string | null;
  gains: Record<string, number>;
  reason: 'time' | 'allGuessed' | 'drawerLeft';
}

export interface RoomState {
  code: string;
  phase: Phase;
  players: PublicPlayer[];
  settings: Settings;
  round: number;
  drawerId: string | null;
  /** Kelimenin maskeli hali: '_' gizli harf, ' ' boşluk, diğerleri açılmış harf. */
  hint: string[] | null;
  /** Mevcut aşamanın bitmesine kalan süre (ms). */
  timeLeftMs: number | null;
  /** Mevcut aşamanın toplam süresi (ms), zaman çubuğu için. */
  phaseDurationMs: number | null;
  turnResult: TurnResult | null;
}

export type ChatKind = 'chat' | 'system' | 'correct' | 'close' | 'insider';

export interface ChatMessage {
  id: number;
  kind: ChatKind;
  text: string;
  name?: string;
  color?: string;
}

// ---- Çizim ----

export const CANVAS_W = 800;
export const CANVAS_H = 600;

export type DrawOp =
  | { t: 'start'; color: string; size: number; x: number; y: number }
  | { t: 'move'; pts: number[] }
  | { t: 'fill'; color: string; x: number; y: number }
  | { t: 'undo' }
  | { t: 'clear' };

export type DrawItem =
  | { k: 'stroke'; color: string; size: number; pts: number[] }
  | { k: 'fill'; color: string; x: number; y: number };

/** Bir çizim işlemini geçmişe uygular (yerinde değiştirir). İstemci ve sunucu aynı kuralı kullanır. */
export function applyOp(items: DrawItem[], op: DrawOp): void {
  switch (op.t) {
    case 'start':
      items.push({ k: 'stroke', color: op.color, size: op.size, pts: [op.x, op.y] });
      break;
    case 'move': {
      const last = items[items.length - 1];
      if (last && last.k === 'stroke') last.pts.push(...op.pts);
      break;
    }
    case 'fill':
      items.push({ k: 'fill', color: op.color, x: op.x, y: op.y });
      break;
    case 'undo':
      items.pop();
      break;
    case 'clear':
      items.length = 0;
      break;
  }
}

// ---- Socket olayları ----

export interface JoinPayload {
  name: string;
  avatar: Avatar;
  sessionId: string;
  code?: string;
}

export type AckResult = { ok: true; code: string } | { ok: false; error: string };

export interface ClientToServer {
  'room:create': (p: JoinPayload, ack: (r: AckResult) => void) => void;
  'room:join': (p: JoinPayload, ack: (r: AckResult) => void) => void;
  'room:leave': () => void;
  'room:settings': (s: Partial<Settings>) => void;
  'game:start': () => void;
  'game:restart': () => void;
  'word:choose': (index: number) => void;
  'draw:op': (op: DrawOp) => void;
  'chat:send': (text: string) => void;
  'react': (kind: 'like' | 'dislike') => void;
}

export interface ServerToClient {
  'room:state': (s: RoomState) => void;
  'word:choices': (words: string[]) => void;
  'word:secret': (word: string) => void;
  'draw:op': (op: DrawOp) => void;
  'draw:history': (items: DrawItem[]) => void;
  'chat:message': (m: ChatMessage) => void;
  'reaction': (r: { kind: 'like' | 'dislike'; name: string }) => void;
}
