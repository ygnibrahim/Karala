// Oyunun sabit değerleri: avatarlar, ayar seçenekleri, kategoriler.
import type { GameMode, Settings } from './types';

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

export const DEFAULT_SETTINGS: Settings = {
  mode: 'classic',
  rounds: 3,
  drawTime: 80,
  category: 'karisik',
  customWords: [],
  maxPlayers: 8,
};

export const ROUND_OPTIONS = [2, 3, 4, 5, 6, 8, 10];
export const DRAW_TIME_OPTIONS = [45, 60, 80, 100, 120, 150];
export const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6, 8, 10, 12];

export const GAME_MODES: { id: GameMode; name: string; description: string; minPlayers: number }[] = [
  { id: 'classic', name: '🎨 Klasik', description: 'Sırayla biri çizer, diğerleri tahmin eder.', minPlayers: 2 },
  {
    id: 'telephone',
    name: '📞 Kırık Telefon',
    description: 'Herkes aynı anda yazar, çizer, tahmin eder; sonunda zincirler gösterilir.',
    minPlayers: 3,
  },
  {
    id: 'impostor',
    name: '🕵️ Sahtekâr',
    description: 'Biri kelimeyi bilmiyor! Sırayla birer çizgi çizin, sonra sahtekârı oylayın.',
    minPlayers: 3,
  },
  {
    id: 'teams',
    name: '🏁 Çizim Yarışı',
    description: 'İki takım aynı kelimeyi aynı anda çizer; ilk bilen takım turu alır.',
    minPlayers: 4,
  },
];

export const TEAM_IDS = ['red', 'blue'] as const;
export const TEAM_NAMES: Record<(typeof TEAM_IDS)[number], string> = { red: '🔴 Kırmızı', blue: '🔵 Mavi' };

/** "Sadece özel kelimeler" kategorisinin kimliği. */
export const CUSTOM_ONLY_CATEGORY = 'ozel';

export const CATEGORIES: { id: string; name: string }[] = [
  { id: 'karisik', name: 'Karışık' },
  { id: 'hayvanlar', name: 'Hayvanlar' },
  { id: 'yiyecekler', name: 'Yiyecek & İçecek' },
  { id: 'esyalar', name: 'Eşyalar' },
  { id: 'meslekler', name: 'Meslekler' },
  { id: 'yerler', name: 'Yerler & Doğa' },
  { id: 'eylemler', name: 'Eylemler' },
  { id: 'tasitlar', name: 'Taşıtlar' },
  { id: 'spor', name: 'Spor & Oyun' },
  { id: 'vucut', name: 'Vücut & Kıyafet' },
  { id: 'fantastik', name: 'Masal & Fantastik' },
  { id: 'teknoloji', name: 'Teknoloji & Bilim' },
  { id: 'muzik', name: 'Müzik & Sanat' },
  { id: 'turkiye', name: "Türkiye'den" },
  { id: CUSTOM_ONLY_CATEGORY, name: 'Sadece özel kelimeler' },
];

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
