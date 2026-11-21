// Tahmin edenlere gösterilen ipucu: her harf için ayrı bir çizgi, kelimeler arasında boşluk.
// Kelimeler kendi içinde bölünmez (satır sonu sadece kelime arasında olur); harf sayısı
// yanında rozet olarak yazar (birden çok kelimede "5 + 4").
import type { CSSProperties } from 'react';

export default function Hint({ hint }: { hint: string[] }) {
  const words: { start: number; chars: string[] }[] = [];
  hint.forEach((c, i) => {
    if (c === ' ') return;
    const last = words[words.length - 1];
    if (last && hint[i - 1] !== ' ' && i > 0) last.chars.push(c);
    else words.push({ start: i, chars: [c] });
  });
  const counts = words.map((w) => w.chars.length);
  // Dar ekranda çizgiler en uzun kelimeye (ve sayı rozetine) göre küçülür; CSS --n'i kullanır.
  const style = { '--n': Math.max(1, ...counts) + 2 } as CSSProperties;

  return (
    <span className="hint" style={style}>
      {words.map((w) => (
        <span key={w.start} className="hint-word">
          {w.chars.map((c, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: harfin konumu kimliğidir; açılan harf animasyonu buna dayanır
            <span key={w.start + j} className={c === '_' ? 'blank' : 'letter'}>
              {c === '_' ? '' : c}
            </span>
          ))}
        </span>
      ))}
      <span className="hint-count">{counts.join(' + ')}</span>
    </span>
  );
}
