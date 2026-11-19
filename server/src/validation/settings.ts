// Oda sahibinin gönderdiği ayar değişikliklerini doğrular. Geçersiz alanlar yok sayılır.
import { CATEGORIES, DRAW_TIME_OPTIONS, GAME_MODES, LIMITS, MAX_PLAYER_OPTIONS, ROUND_OPTIONS, type Settings } from '@shared';
import { containsProfanity } from '../moderation/profanity';
import { cleanText, normalizeGuess } from '../utils/text';

const pick = (v: unknown, options: readonly number[]): number | undefined =>
  typeof v === 'number' && options.includes(v) ? v : undefined;

export function sanitizeCustomWords(input: unknown[]): string[] {
  const words = input
    .filter((w): w is string => typeof w === 'string')
    .map((w) => cleanText(w, LIMITS.customWordLength).toLocaleLowerCase('tr'))
    .filter((w) => normalizeGuess(w).length >= 2 && !containsProfanity(w));
  return [...new Set(words)].slice(0, LIMITS.customWordCount);
}

/**
 * Mevcut ayarlara geçerli değişiklikleri uygular ve yeni ayarları döner.
 * `playerCount`: en fazla oyuncu sayısı odadaki oyunculardan aşağı indirilemez.
 */
export function applySettings(current: Settings, input: unknown, playerCount: number): Settings {
  if (!input || typeof input !== 'object') return current;
  const s = input as Record<string, unknown>;
  const next = { ...current };

  if (GAME_MODES.some((m) => m.id === s.mode)) next.mode = s.mode as Settings['mode'];
  next.rounds = pick(s.rounds, ROUND_OPTIONS) ?? next.rounds;
  next.drawTime = pick(s.drawTime, DRAW_TIME_OPTIONS) ?? next.drawTime;
  const maxPlayers = pick(s.maxPlayers, MAX_PLAYER_OPTIONS);
  if (maxPlayers !== undefined) next.maxPlayers = Math.max(maxPlayers, playerCount);
  if (typeof s.category === 'string' && CATEGORIES.some((c) => c.id === s.category)) next.category = s.category;
  if (Array.isArray(s.customWords)) next.customWords = sanitizeCustomWords(s.customWords);

  return next;
}
