import type { ChatMessage, RoomState } from '@shared';

/** Oyun ekranlarının ihtiyaç duyduğu ortak veri (App tarafından sağlanır). */
export interface GameData {
  room: RoomState;
  /** room:state'in alındığı yerel zaman; geri sayım için. */
  stateAt: number;
  /** Bu oyuncunun herkese açık kimliği. */
  meId: string;
  /** Çizen ya da kelimeyi bilen oyuncu için gizli kelime. */
  secret: string | null;
  choices: string[];
  messages: ChatMessage[];
  /** Sadece oda sahibine: özel kelime listesi. */
  customWords: string[];
  leave: () => void;
}
