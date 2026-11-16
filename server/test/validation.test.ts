// İstemciden gelen her verinin doğrulanması: kötü niyetli girdiler reddedilmeli ya da güvenli hale getirilmeli.
import { AVATAR_COLORS, AVATAR_FACES, CANVAS_H, CANVAS_W, DEFAULT_SETTINGS } from '@shared';
import { describe, expect, it } from 'vitest';
import { SERVER_LIMITS } from '../src/config';
import { sanitizeDrawOp } from '../src/validation/drawOp';
import { sanitizeChat, sanitizeJoin, sanitizeRoomCode } from '../src/validation/player';
import { applySettings } from '../src/validation/settings';

const SESSION = 'abcdefghijklmnopqrstuv';

describe('sanitizeDrawOp', () => {
  it('geçerli işlemleri kabul eder', () => {
    expect(sanitizeDrawOp({ t: 'start', color: '#FF0000', size: 10, x: 5, y: 6 })).toEqual({
      t: 'start',
      color: '#ff0000',
      size: 10,
      x: 5,
      y: 6,
    });
    expect(sanitizeDrawOp({ t: 'move', pts: [1, 2, 3, 4] })).toEqual({ t: 'move', pts: [1, 2, 3, 4] });
    expect(sanitizeDrawOp({ t: 'undo' })).toEqual({ t: 'undo' });
    expect(sanitizeDrawOp({ t: 'clear' })).toEqual({ t: 'clear' });
  });

  it('koordinatları tuval sınırlarına kırpar ve yuvarlar', () => {
    expect(sanitizeDrawOp({ t: 'start', color: '#000000', size: 5, x: -50, y: 99999.7 })).toMatchObject({ x: 0, y: CANVAS_H });
    expect(sanitizeDrawOp({ t: 'fill', color: '#000000', x: 1e9, y: 3.6 })).toMatchObject({ x: CANVAS_W - 1, y: 4 });
  });

  it('fırça boyutunu sınırlar, sıfır/negatif boyutu reddeder', () => {
    expect(sanitizeDrawOp({ t: 'start', color: '#000000', size: 5000, x: 1, y: 1 })).toMatchObject({
      size: SERVER_LIMITS.maxBrushSize,
    });
    expect(sanitizeDrawOp({ t: 'start', color: '#000000', size: 0, x: 1, y: 1 })).toBeNull();
    expect(sanitizeDrawOp({ t: 'start', color: '#000000', size: -4, x: 1, y: 1 })).toBeNull();
  });

  it.each([
    ['isim', 'red'],
    ['kısa hex', '#fff'],
    ['betik', 'javascript:alert(1)'],
    ['css enjeksiyonu', '#000000; background:url(x)'],
    ['sayı', 123],
  ])('geçersiz rengi reddeder (%s)', (_name, color) => {
    expect(sanitizeDrawOp({ t: 'start', color, size: 5, x: 1, y: 1 })).toBeNull();
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['metin', '10'],
    ['nesne', { valueOf: () => 5 }],
    ['null', null],
  ])('sayı olmayan koordinatı reddeder (%s)', (_name, x) => {
    expect(sanitizeDrawOp({ t: 'start', color: '#000000', size: 5, x, y: 1 })).toBeNull();
  });

  it('hatalı nokta listelerini reddeder', () => {
    expect(sanitizeDrawOp({ t: 'move', pts: [] })).toBeNull();
    expect(sanitizeDrawOp({ t: 'move', pts: [1, 2, 3] })).toBeNull(); // tek sayıda
    expect(sanitizeDrawOp({ t: 'move', pts: 'abc' })).toBeNull();
    expect(sanitizeDrawOp({ t: 'move', pts: [1, 'x'] })).toBeNull();
    expect(sanitizeDrawOp({ t: 'move', pts: new Array(SERVER_LIMITS.maxPointsPerMove + 2).fill(1) })).toBeNull();
  });

  it('bilinmeyen şekil ve işlem türlerini reddeder', () => {
    expect(sanitizeDrawOp({ t: 'shape', shape: 'star', color: '#000000', size: 5, x1: 0, y1: 0, x2: 1, y2: 1 })).toBeNull();
    expect(sanitizeDrawOp({ t: 'eval', code: 'boom' })).toBeNull();
    expect(sanitizeDrawOp(null)).toBeNull();
    expect(sanitizeDrawOp('start')).toBeNull();
  });

  it('fazladan alanları ve prototip kirletme denemelerini atar', () => {
    const evil = JSON.parse('{"t":"start","color":"#000000","size":5,"x":1,"y":1,"__proto__":{"admin":true},"extra":"<img>"}');
    const clean = sanitizeDrawOp(evil);
    expect(clean).toEqual({ t: 'start', color: '#000000', size: 5, x: 1, y: 1 });
    expect(Object.getPrototypeOf(clean)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).admin).toBeUndefined();
  });

  it('şekilleri doğrular', () => {
    expect(sanitizeDrawOp({ t: 'shape', shape: 'triangle', color: '#123abc', size: 4, x1: 1, y1: 2, x2: 3, y2: 4 })).toEqual({
      t: 'shape',
      shape: 'triangle',
      color: '#123abc',
      size: 4,
      x1: 1,
      y1: 2,
      x2: 3,
      y2: 4,
    });
  });
});

describe('sanitizeJoin', () => {
  it('geçerli isteği temizler', () => {
    expect(
      sanitizeJoin({ sessionId: SESSION, name: '  Ayşe  ', avatar: { color: AVATAR_COLORS[2], face: AVATAR_FACES[3] } }),
    ).toEqual({
      sessionId: SESSION,
      name: 'Ayşe',
      avatar: { color: AVATAR_COLORS[2], face: AVATAR_FACES[3] },
    });
  });

  it.each([
    ['yok', undefined],
    ['çok kısa (tahmin edilebilir)', 'abc'],
    ['çok uzun', 'a'.repeat(65)],
    ['geçersiz karakter', 'abcdefghijklmnop<script>'],
    ['sayı', 1234567890123456],
  ])('geçersiz oturum anahtarını reddeder (%s)', (_name, sessionId) => {
    expect(sanitizeJoin({ sessionId, name: 'x' })).toBeNull();
  });

  it('ismi kısaltır, görünmez karakterleri siler, boşsa varsayılan verir', () => {
    expect(sanitizeJoin({ sessionId: SESSION, name: 'x'.repeat(100) })?.name).toHaveLength(16);
    expect(sanitizeJoin({ sessionId: SESSION, name: '​‮' })?.name).toBe('Oyuncu');
    expect(sanitizeJoin({ sessionId: SESSION, name: 42 })?.name).toBe('Oyuncu');
  });

  it('listede olmayan avatarı varsayılana çevirir', () => {
    const r = sanitizeJoin({ sessionId: SESSION, name: 'x', avatar: { color: 'url(evil)', face: '<b>' } });
    expect(r?.avatar).toEqual({ color: AVATAR_COLORS[0], face: AVATAR_FACES[0] });
  });

  it('nesne olmayan girdiyi reddeder', () => {
    expect(sanitizeJoin(null)).toBeNull();
    expect(sanitizeJoin('join')).toBeNull();
  });
});

describe('sanitizeRoomCode / sanitizeChat', () => {
  it('oda kodunu büyük harfe çevirir ve biçimini doğrular', () => {
    expect(sanitizeRoomCode(' abcde ')).toBe('ABCDE');
    expect(sanitizeRoomCode('ABC')).toBeNull();
    expect(sanitizeRoomCode('AB1DE')).toBeNull();
    expect(sanitizeRoomCode({ code: 'ABCDE' })).toBeNull();
  });

  it('sohbet metnini temizler ve boşsa reddeder', () => {
    expect(sanitizeChat('  selam  ')).toBe('selam');
    expect(sanitizeChat('   ')).toBeNull();
    expect(sanitizeChat('​')).toBeNull();
    expect(sanitizeChat(['dizi'])).toBeNull();
    expect(sanitizeChat('x'.repeat(1000))).toHaveLength(100);
  });
});

describe('applySettings', () => {
  const base = { ...DEFAULT_SETTINGS, customWords: [] };

  it('sadece izin verilen değerleri uygular', () => {
    const next = applySettings(base, { rounds: 5, drawTime: 999, maxPlayers: 4, category: 'hayvanlar' }, 1);
    expect(next).toMatchObject({ rounds: 5, drawTime: base.drawTime, maxPlayers: 4, category: 'hayvanlar' });
  });

  it('bilinmeyen kategoriyi ve fazladan alanları yok sayar', () => {
    const next = applySettings(base, { category: '../../etc', isAdmin: true }, 1);
    expect(next).toEqual(base);
  });

  it('en fazla oyuncu sayısı odadakilerin altına inemez', () => {
    expect(applySettings(base, { maxPlayers: 2 }, 5).maxPlayers).toBe(5);
  });

  it('özel kelimeleri temizler, tekrarları atar ve sınırlar', () => {
    const words = ['  Kedi ', 'kedi', 'x', 42, 'A'.repeat(100), ...Array.from({ length: 300 }, (_, i) => `kelime${i}`)];
    const next = applySettings(base, { customWords: words }, 1);
    expect(next.customWords[0]).toBe('kedi');
    expect(next.customWords.filter((w) => w === 'kedi')).toHaveLength(1);
    expect(next.customWords).not.toContain('x');
    expect(next.customWords.every((w) => w.length <= 30)).toBe(true);
    expect(next.customWords.length).toBeLessThanOrEqual(200);
  });

  it('nesne olmayan girdide ayarları değiştirmez', () => {
    expect(applySettings(base, 'rounds=10', 1)).toBe(base);
  });
});
