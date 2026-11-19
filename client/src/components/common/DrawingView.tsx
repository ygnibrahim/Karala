// Bir çizimi salt okunur gösterir (Kırık Telefon'da tahmin adımı ve gösterim).
import { CANVAS_H, CANVAS_W, type DrawItem } from '@shared';
import { useEffect, useRef } from 'react';
import { redraw } from '../../canvas/render';
import { useT } from '../../i18n';

export default function DrawingView({ drawing, className = '' }: { drawing: DrawItem[]; className?: string }) {
  const t = useT();
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = ref.current?.getContext('2d', { willReadFrequently: true });
    if (ctx) redraw(ctx, drawing);
  }, [drawing]);

  return (
    <canvas
      ref={ref}
      width={CANVAS_W}
      height={CANVAS_H}
      className={`drawing-view ${className}`}
      role="img"
      aria-label={drawing.length ? t('common.drawing') : t('common.emptyDrawing')}
    />
  );
}
