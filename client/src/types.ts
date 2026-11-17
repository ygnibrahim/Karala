import type { ChatMessage, ImpostorRole, RevealData, RoomState, TelephoneTask } from '@shared';

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
  /** Kırık Telefon: bu oyuncunun şu anki görevi. */
  task: TelephoneTask | null;
  /** Kırık Telefon gösterimi: açık zincir. */
  reveal: RevealData | null;
  /** Sahtekâr: bu oyuncunun bu turdaki rolü. */
  role: ImpostorRole | null;
  leave: () => void;
}
