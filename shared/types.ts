// Oda ve oyuncu durumunun tipleri.
import type { DrawItem } from './drawing';

/**
 * Klasik mod: choosing → drawing → turnEnd (tekrar) → gameEnd.
 * Kırık Telefon: telephone (yaz/çiz/tahmin adımları) → reveal (zincirlerin gösterimi) → gameEnd.
 * Sahtekâr: impostor (aşamaları ImpostorPublic.stage'de) → gameEnd.
 */
export type Phase = 'lobby' | 'choosing' | 'drawing' | 'turnEnd' | 'telephone' | 'reveal' | 'impostor' | 'gameEnd';

export type GameMode = 'classic' | 'telephone' | 'impostor';

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
  mode: GameMode;
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
  /** Sadece Kırık Telefon modunda dolu. */
  telephone: TelephonePublic | null;
  /** Sadece Sahtekâr modunda dolu. */
  impostor: ImpostorPublic | null;
}

// ---- Kırık Telefon ----

export type TelephoneStepKind = 'write' | 'draw' | 'guess';

/** Herkese açık Kırık Telefon durumu (içerik yok: kimse başkasının zincirini önceden görmez). */
export interface TelephonePublic {
  /** 0'dan başlayan adım numarası. */
  step: number;
  totalSteps: number;
  kind: TelephoneStepKind;
  /** Bu adımda gönderimini yapmış oyuncular. */
  submitted: string[];
  /** Zincirlere katılan oyuncular (oyun başındaki sıra). */
  participants: string[];
  /** Gösterim aşamasında: hangi zincirin kaçıncı adımı açık. */
  reveal: { chain: number; entry: number; totalChains: number; chainLength: number } | null;
  /** Oyuncu kimliği → aldığı 😂 sayısı. */
  laughs: Record<string, number>;
}

/** Bir oyuncunun bu adımdaki görevi (sadece ona gönderilir). */
export interface TelephoneTask {
  step: number;
  kind: TelephoneStepKind;
  /** Çizim adımı: çizilecek metin. Tahmin adımı: tahmin edilecek çizim. Yazma adımı: boş. */
  prompt: { text: string } | { drawing: DrawItem[] } | null;
  /** Yazma adımında "fikrim yok" diyenler için öneri. */
  suggestion?: string;
  submitted: boolean;
}

export interface RevealEntry {
  kind: 'text' | 'drawing';
  authorId: string;
  authorName: string;
  text?: string;
  drawing?: DrawItem[];
}

/** Gösterilen zincirin şu ana kadar açılmış adımları. */
export interface RevealData {
  chain: number;
  ownerName: string;
  entries: RevealEntry[];
}

// ---- Sahtekâr ----

/** intro: roller gösterilir · draw: sırayla tek çizgi · vote: oylama · guess: yakalanan sahtekâr kelimeyi tahmin eder · result: sonuç */
export type ImpostorStage = 'intro' | 'draw' | 'vote' | 'guess' | 'result';

export interface ImpostorResult {
  impostorId: string;
  word: string;
  /** Oy veren → oy verilen. */
  votes: Record<string, string>;
  caught: boolean;
  guess: string | null;
  guessedRight: boolean;
  gains: Record<string, number>;
}

/** Herkese açık Sahtekâr durumu: sahtekârın kim olduğu ve kelime sonuç aşamasına kadar yoktur. */
export interface ImpostorPublic {
  round: number;
  totalRounds: number;
  stage: ImpostorStage;
  /** Bu turun çizim sırası. */
  order: string[];
  /** Sırası gelen oyuncu (çizim aşamasında). */
  turnPlayerId: string | null;
  /** Kaçıncı tur dönüş (1'den başlar). */
  lap: number;
  totalLaps: number;
  /** Kelimenin kategorisi: herkes görür (sahtekârın tek ipucu). */
  category: string;
  /** Oy vermiş oyuncular (kime verdiği gizli). */
  voted: string[];
  result: ImpostorResult | null;
}

/** Oyuncuya özel rol bilgisi. Sahtekâra kelime gönderilmez. */
export interface ImpostorRole {
  round: number;
  isImpostor: boolean;
  word: string | null;
  category: string;
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
