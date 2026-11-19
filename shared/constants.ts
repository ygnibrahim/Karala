// Oyunun sabit değerleri: avatarlar, ayar seçenekleri, kategoriler.
import type { GameMode, Lang, ReportReason, Settings } from './types';

export const AVATAR_COLORS = [
  '#ff6b6b',
  '#ffa94d',
  '#ffd43b',
  '#69db7c',
  '#38d9a9',
  '#4dabf7',
  '#748ffc',
  '#b197fc',
  '#f783ac',
  '#adb5bd',
];

export const AVATAR_FACES = [
  '😀',
  '😎',
  '🤓',
  '🥳',
  '😺',
  '🐶',
  '🦊',
  '🐸',
  '🐼',
  '🤖',
  '👻',
  '🦄',
  '🐵',
  '🐙',
  '🦁',
  '🐧',
  '🧿',
  '🐿️',
];

export const LANGUAGES: readonly Lang[] = ['tr', 'en'];

export const DEFAULT_SETTINGS: Settings = {
  mode: 'classic',
  language: 'tr',
  rounds: 3,
  drawTime: 80,
  category: 'karisik',
  customWords: [],
  maxPlayers: 8,
};

export const ROUND_OPTIONS = [2, 3, 4, 5, 6, 8, 10];
export const DRAW_TIME_OPTIONS = [45, 60, 80, 100, 120, 150];
export const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

/** Oyun modları. Görünen adları ve açıklamaları istemcide çevrilir (client/src/i18n). */
export const GAME_MODES: { id: GameMode; minPlayers: number }[] = [
  { id: 'classic', minPlayers: 2 },
  { id: 'telephone', minPlayers: 3 },
  { id: 'impostor', minPlayers: 3 },
  { id: 'teams', minPlayers: 4 },
];

export const TEAM_IDS = ['red', 'blue'] as const;

/** "Sadece özel kelimeler" kategorisinin kimliği. */
export const CUSTOM_ONLY_CATEGORY = 'ozel';

/** Kelime kategorileri. Görünen adları istemcide çevrilir; kelime listeleri sunucuda dil başına tutulur. */
export const CATEGORIES: { id: string }[] = [
  { id: 'karisik' },
  { id: 'hayvanlar' },
  { id: 'yiyecekler' },
  { id: 'esyalar' },
  { id: 'meslekler' },
  { id: 'yerler' },
  { id: 'eylemler' },
  { id: 'tasitlar' },
  { id: 'spor' },
  { id: 'vucut' },
  { id: 'fantastik' },
  { id: 'teknoloji' },
  { id: 'muzik' },
  { id: 'turkiye' },
  { id: CUSTOM_ONLY_CATEGORY },
];

export const REPORT_REASONS: readonly ReportReason[] = ['abuse', 'drawing', 'spam', 'other'];

/** Gizli oturum anahtarının biçimi: istemci üretir, sunucu doğrular. */
export const SESSION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,64}$/;

/** Metin uzunluk sınırları: istemci girişleri ve sunucu doğrulaması aynı değerleri kullanır. */
export const LIMITS = {
  nameLength: 16,
  chatLength: 100,
  customWordLength: 30,
  customWordCount: 200,
  roomCodeLength: 5,
} as const;
