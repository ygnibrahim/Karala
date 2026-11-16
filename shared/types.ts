// Oda ve oyuncu durumunun tipleri.

export type Phase = 'lobby' | 'choosing' | 'drawing' | 'turnEnd' | 'gameEnd';

export interface Avatar {
  color: string;
  face: string;
}

export interface PublicPlayer {
  /** Herkese açık oyuncu kimliği. Gizli oturum anahtarından farklıdır. */
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

/**
 * Herkese yayınlanan ayarlar. Özel kelimelerin kendisi gönderilmez (tahmin edenler aday listeyi
 * görmesin diye); sadece sayısı gider. Liste yalnızca oda sahibine ayrıca gönderilir.
 */
export type PublicSettings = Omit<Settings, 'customWords'> & { customWordCount: number };

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
  settings: PublicSettings;
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

export type ReactionKind = 'like' | 'dislike';
