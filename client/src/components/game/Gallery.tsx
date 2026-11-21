// Oyun sonu galerisi: bu oyunda çizilen resimler. Dokununca büyür; telefona kaydedilir ya da paylaşılır.
import type { GalleryItem } from '@shared';
import { useEffect, useMemo, useState } from 'react';
import { shareImage, shareOrDownload, thumbnail } from '../../canvas/exportImage';
import { useT } from '../../i18n';
import { socket } from '../../lib/socket';
import DrawingView from '../common/DrawingView';
import Sheet from '../common/Sheet';

/** Dosya adında sorun çıkarmayacak sade bir ad. */
const slug = (s: string) =>
  s
    .toLocaleLowerCase('tr')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/ı/g, 'i')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'cizim';

export default function Gallery() {
  const t = useT();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    socket.on('game:gallery', setItems);
    socket.emit('gallery:get');
    return () => {
      socket.off('game:gallery', setItems);
    };
  }, []);

  const thumbs = useMemo(() => items.map((it) => thumbnail(it.drawing)), [items]);

  if (items.length === 0) return null;

  const byLine = (it: GalleryItem) =>
    it.team ? t('gallery.byTeam', { team: t(`team.${it.team}`) }) : it.together ? t('gallery.together') : (it.drawerName ?? '?');
  const current = open === null ? null : items[open];

  const save = async (it: GalleryItem) => {
    setBusy(true);
    try {
      const blob = await shareImage(it.drawing, `${it.word} · ${byLine(it)}`);
      if (blob) await shareOrDownload(blob, `karala-${slug(it.word)}.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card gallery">
      <h2>{t('gallery.title', { n: items.length })}</h2>
      <div className="gallery-grid">
        {items.map((it, i) => (
          <button
            // biome-ignore lint/suspicious/noArrayIndexKey: galeri sırası sabit, öğelerin kimliği yok
            key={i}
            type="button"
            className={`gallery-tile${it.team ? ` team-${it.team}` : ''}`}
            onClick={() => setOpen(i)}
            aria-label={`${it.word} · ${byLine(it)}`}
          >
            <img src={thumbs[i]} alt="" />
            <b>{it.word}</b>
            <small>{byLine(it)}</small>
          </button>
        ))}
      </div>

      {current && open !== null && (
        <Sheet label={current.word} className="gallery-sheet" onClose={() => setOpen(null)}>
          <h3 className="sheet-title">{current.word}</h3>
          <p className="muted small">{byLine(current)}</p>
          <DrawingView drawing={current.drawing} />
          <div className="gallery-nav">
            <button
              type="button"
              className="icon-btn"
              disabled={open === 0}
              onClick={() => setOpen(open - 1)}
              aria-label={t('gallery.prev')}
            >
              ‹
            </button>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => save(current)}>
              {t('gallery.save')}
            </button>
            <button
              type="button"
              className="icon-btn"
              disabled={open === items.length - 1}
              onClick={() => setOpen(open + 1)}
              aria-label={t('gallery.next')}
            >
              ›
            </button>
          </div>
        </Sheet>
      )}
    </section>
  );
}
