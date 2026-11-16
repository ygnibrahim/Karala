import { describe, expect, it } from 'vitest';
import { applyOp, type DrawItem } from './drawing';

describe('applyOp', () => {
  it('çizgi başlatır ve noktaları ekler', () => {
    const items: DrawItem[] = [];
    applyOp(items, { t: 'start', color: '#000000', size: 4, x: 1, y: 2 });
    applyOp(items, { t: 'move', pts: [3, 4, 5, 6] });
    expect(items).toEqual([{ k: 'stroke', color: '#000000', size: 4, pts: [1, 2, 3, 4, 5, 6] }]);
  });

  it('başlamamış çizgiye nokta eklemez', () => {
    const items: DrawItem[] = [{ k: 'fill', color: '#ffffff', x: 0, y: 0 }];
    applyOp(items, { t: 'move', pts: [1, 1] });
    expect(items).toHaveLength(1);
  });

  it('şekil ekler, geri alır ve temizler', () => {
    const items: DrawItem[] = [];
    applyOp(items, { t: 'shape', shape: 'rect', color: '#000000', size: 2, x1: 0, y1: 0, x2: 5, y2: 5 });
    applyOp(items, { t: 'fill', color: '#ff0000', x: 2, y: 2 });
    expect(items.map((i) => i.k)).toEqual(['shape', 'fill']);
    applyOp(items, { t: 'undo' });
    expect(items.map((i) => i.k)).toEqual(['shape']);
    applyOp(items, { t: 'clear' });
    expect(items).toEqual([]);
  });

  it('şekil öğesine işlem türü alanını (t) taşımaz', () => {
    const items: DrawItem[] = [];
    applyOp(items, { t: 'shape', shape: 'line', color: '#000000', size: 2, x1: 0, y1: 0, x2: 5, y2: 5 });
    expect(items[0]).not.toHaveProperty('t');
  });
});
