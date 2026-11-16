// Odaya katılma isteğini ve sohbet metnini doğrular.
import { AVATAR_COLORS, AVATAR_FACES, type Avatar, LIMITS, SESSION_TOKEN_PATTERN } from '@shared';
import { cleanText } from '../utils/text';

export interface CleanJoin {
  sessionId: string;
  name: string;
  avatar: Avatar;
}

export function sanitizeJoin(input: unknown): CleanJoin | null {
  if (!input || typeof input !== 'object') return null;
  const p = input as Record<string, unknown>;

  // Oturum anahtarı tahmin edilemez olmalı: istemci crypto.randomUUID() ile üretir.
  if (typeof p.sessionId !== 'string' || !SESSION_TOKEN_PATTERN.test(p.sessionId)) return null;

  const name = (typeof p.name === 'string' ? cleanText(p.name, LIMITS.nameLength) : '') || 'Oyuncu';

  const avatarIn = (p.avatar && typeof p.avatar === 'object' ? p.avatar : {}) as Record<string, unknown>;
  const color = typeof avatarIn.color === 'string' && AVATAR_COLORS.includes(avatarIn.color) ? avatarIn.color : AVATAR_COLORS[0];
  const face = typeof avatarIn.face === 'string' && AVATAR_FACES.includes(avatarIn.face) ? avatarIn.face : AVATAR_FACES[0];

  return { sessionId: p.sessionId, name, avatar: { color, face } };
}

export function sanitizeRoomCode(input: unknown): string | null {
  const code = typeof input === 'string' ? input.trim().toUpperCase() : '';
  return code.length === LIMITS.roomCodeLength && /^[A-Z]+$/.test(code) ? code : null;
}

export function sanitizeChat(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  return cleanText(input, LIMITS.chatLength) || null;
}
