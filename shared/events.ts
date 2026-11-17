// Socket.IO olaylarının imzaları: istemci ve sunucu bu sözleşmeye göre konuşur.
import type { DrawItem, DrawOp } from './drawing';
import type { Avatar, ChatMessage, ReactionKind, RevealData, RoomState, Settings, TelephoneTask } from './types';

export interface JoinPayload {
  name: string;
  avatar: Avatar;
  /** Tarayıcı sekmesine özel gizli oturum anahtarı. Asla başka oyunculara gönderilmez. */
  sessionId: string;
  code?: string;
}

export type AckResult = { ok: true; code: string; playerId: string } | { ok: false; error: string };

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
  react: (kind: ReactionKind) => void;
  /** Kırık Telefon: yazma/tahmin adımında metni, çizim adımında "bitti"yi gönderir. */
  'tp:submit': (step: number, text?: string) => void;
  /** Kırık Telefon: çizim adımında kendi tuvaline çizim işlemi (başkasına iletilmez). */
  'tp:draw': (step: number, op: DrawOp) => void;
  /** Kırık Telefon gösterimi: oda sahibi sonraki adıma geçer. */
  'tp:next': () => void;
  /** Kırık Telefon gösterimi: açık olan adıma 😂. */
  'tp:laugh': () => void;
}

export interface ServerToClient {
  'room:state': (s: RoomState) => void;
  /** Sadece oda sahibine: özel kelime listesi. */
  'room:customWords': (words: string[]) => void;
  'word:choices': (words: string[]) => void;
  'word:secret': (word: string) => void;
  'draw:op': (op: DrawOp) => void;
  'draw:history': (items: DrawItem[]) => void;
  'chat:message': (m: ChatMessage) => void;
  reaction: (r: { kind: ReactionKind; name: string }) => void;
  /** Kırık Telefon: bu oyuncunun bu adımdaki görevi. */
  'tp:task': (task: TelephoneTask) => void;
  /** Kırık Telefon gösterimi: açık zincirin içeriği. */
  'tp:reveal': (data: RevealData) => void;
}
