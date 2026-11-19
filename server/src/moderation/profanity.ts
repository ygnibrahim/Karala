// Türkçe küfür/argo filtresi.
//
// Yaklaşım: metni kelimelere ayır, her kelimeyi "kaçırma hilelerinden" arındır (büyük harf, @→a, 1→i,
// araya konan nokta/yıldız, uzatılmış harfler), sonra kara listeyle karşılaştır.
// Türkçe harfler bilerek sadeleştirilmez: "şık" → "sik", "şikayet" → "sikayet" gibi masum kelimeler
// yanlışlıkla yakalanmasın. Bu yüzden listede hem Türkçe hem ASCII yazımlar ayrı ayrı bulunur.

const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);

/** Tam eşleşmesi gereken kısa kelimeler (başka kelimelerin içinde de geçtikleri için). */
const EXACT = new Set(
  words(`
    am amk amq aq mk sg oç oc piç pic göt götü götün götünü gotu sik sikk sikim siki sikini yarak taşak tasak
    puşt pust ibne ipne kahpe gavat pezo yavşak yavsak kaltak sürtük surtuk fahişe fahise şıllık sillik orospu
    orosbu orspu amcık amcik yarrak dalyarak pezevenk pezeveng sikerim sikeyim siktir amına amina
  `),
);

/** Bu köklerle başlayan her kelime yakalanır (masum kelimelerle çakışmadığı testlerle denetlenir). */
const PREFIXES = words(`
  orospu orosbu orspu amcık amcik amına amina amınak aminak amını amini siktir sikti sikerim sikeyim siktiğ
  siktig sikiş sikis sikik sikici sikko yarrak yarağ yarag dalyarak dalyarag pezevenk pezeveng kahpe yavşak
  yavsak kaltak sürtük surtuk fahişe fahise ibneli ibnelik götveren gotveren götoş gotos taşşak tassak şerefsiz
  serefsiz piçlik piclik puştluk pustluk gavatlık gavatlik ananı anani ananızı ananizi bacını bacini
`);

/** Rakam/simgeyle harf taklidi. */
const LEET: Record<string, string> = { '@': 'a', '4': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', $: 's', '5': 's', '7': 't' };

/** Kelimeyi karşılaştırmaya hazırlar: küçük harf, taklit harfler, ara işaretler ve uzatmalar temizlenir. */
export function normalizeToken(token: string): string {
  return token
    .toLocaleLowerCase('tr')
    .replace(/[@431!0$57]/g, (c) => LEET[c] ?? c)
    .replace(/[^\p{L}]/gu, '') // s.i.k, s*i*k, s-i-k → sik
    .replace(/(\p{L})\1{2,}/gu, '$1'); // siiiik → sik (iki harf kalabilir: "sikk")
}

function isProfaneToken(token: string): boolean {
  const n = normalizeToken(token);
  if (!n) return false;
  // Tekrarları tamamen teke indirerek de bak (siiik → sik, ammmk → amk).
  const single = n.replace(/(\p{L})\1+/gu, '$1');
  return [n, single].some((t) => EXACT.has(t) || PREFIXES.some((p) => t.startsWith(p)));
}

/**
 * Harfleri boşlukla ayırarak kaçırma ("s i k t i r"): tek harflik ardışık parçaları birleştirip de bak.
 * Sadece en az 3 tek harf yan yanaysa (normal metinde "a b" gibi şeyler nadir).
 */
function spacedOutWords(tokens: string[]): string[] {
  const joined: string[] = [];
  let run: string[] = [];
  const flush = () => {
    if (run.length >= 3) joined.push(run.join(''));
    run = [];
  };
  for (const t of tokens) {
    if (normalizeToken(t).length === 1) run.push(t);
    else flush();
  }
  flush();
  return joined;
}

export function containsProfanity(text: string): boolean {
  const tokens = text.split(/\s+/).filter(Boolean);
  return tokens.some(isProfaneToken) || spacedOutWords(tokens).some(isProfaneToken);
}

/** Küfürlü kelimeleri yıldızlar; diğer her şeyi olduğu gibi bırakır. */
export function maskProfanity(text: string): string {
  let masked = text.replace(/\S+/g, (token) => (isProfaneToken(token) ? '*'.repeat(Math.min(token.length, 8)) : token));
  // Harf harf yazılmış küfürler: hepsini birden yıldızla.
  if (spacedOutWords(masked.split(/\s+/)).some(isProfaneToken)) masked = '***';
  return masked;
}
