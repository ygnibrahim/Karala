// Oda sahibinin özel kelime listesi bu cihazda hatırlanır: bir dahaki odada otomatik gelir.
const KEY = 'karala:customWords';

export function loadCustomWords(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((w): w is string => typeof w === 'string').slice(0, 200) : [];
  } catch {
    return [];
  }
}

export function saveCustomWords(words: string[]): void {
  try {
    const clean = words.map((w) => w.trim()).filter(Boolean);
    if (clean.length) localStorage.setItem(KEY, JSON.stringify(clean));
    else localStorage.removeItem(KEY);
  } catch {
    /* gizli sekme vb.: hatırlanmaz */
  }
}
