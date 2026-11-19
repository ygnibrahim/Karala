import { describe, expect, it } from 'vitest';
import { containsProfanity, maskProfanity } from '../src/moderation/profanity';

describe('küfür filtresi', () => {
  it.each([
    'amk',
    'AMK',
    'aq',
    'orospu',
    'orospuçocuğu',
    'siktir',
    'siktirgit',
    'sikerim',
    'piç',
    'yarrak',
    'amına',
    'ibne',
    'pezevenk',
    'şerefsiz',
  ])('yakalar: %s', (w) => {
    expect(containsProfanity(w)).toBe(true);
  });

  it.each([
    ['leet', 's1kt1r'],
    ['simge', '@mk'],
    ['nokta', 's.i.k.t.i.r'],
    ['yıldız', 'o*r*o*s*p*u'],
    ['uzatma', 'siiiiiktir'],
    ['büyük harf', 'OROSPU'],
    ['harf harf', 's i k t i r'],
    ['cümle içinde', 'sen tam bir şerefsizsin'],
  ])('kaçırma denemesini yakalar (%s): %s', (_n, w) => {
    expect(containsProfanity(w)).toBe(true);
  });

  it.each([
    'götürmek',
    'eve götür',
    'şikayet',
    'şık elbise',
    'sikke',
    'amaç',
    'ama',
    'ambulans',
    'damla',
    'ağaç',
    'kamyon',
    'piknik sepeti',
    'pikachu',
    'yarasa',
    'yaprak',
    'taşıt',
    'bacak',
    'mal',
    'aptal',
    'salak',
    'kahve',
    'sıkı',
    'sıkıcı',
    'ibrik',
    'amcaoğlu',
    'pastane',
    'bu bir test cümlesidir',
    'a b c',
  ])('masum metne takılmaz: %s', (w) => {
    expect(containsProfanity(w)).toBe(false);
  });

  it('sadece küfürlü kelimeyi yıldızlar', () => {
    expect(maskProfanity('merhaba amk nasılsın')).toBe('merhaba *** nasılsın');
    expect(maskProfanity('bu çizim çok güzel')).toBe('bu çizim çok güzel');
  });

  it('harf harf yazılmış küfürde mesajın tamamı yıldızlanır', () => {
    expect(maskProfanity('s i k t i r')).toBe('***');
  });
});

describe('English profanity filter', () => {
  it.each([
    'fuck',
    'FUCK',
    'f.u.c.k',
    'fuuuck',
    'motherfucker',
    'shit',
    'bullshit',
    'shitty',
    'shithead',
    'bitch',
    'asshole',
    'ass',
    'dick',
    'cunt',
    'wtf',
  ])('catches: %s', (w) => {
    expect(containsProfanity(w)).toBe(true);
  });

  it.each([
    'class',
    'assist',
    'passage',
    'bass guitar',
    'cocktail',
    'dickens',
    'scunthorpe',
    'shiitake mushroom',
    'fukara',
    'pascal',
    'grass',
    'hello there',
  ])('does not flag: %s', (w) => {
    expect(containsProfanity(w)).toBe(false);
  });

  it('masks English profanity in chat', () => {
    expect(maskProfanity('what the fuck is that')).not.toContain('fuck');
  });
});
