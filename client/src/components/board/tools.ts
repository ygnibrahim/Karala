// Çizim araçlarının tanımları: renk paleti, kalınlıklar ve şekiller.
import type { ShapeKind } from '@shared';

export const COLORS = [
  '#000000',
  '#5c5f66',
  '#ffffff',
  '#8d5a2b',
  '#c92a2a',
  '#ff6b6b',
  '#e8590c',
  '#ffa94d',
  '#fcc419',
  '#2b8a3e',
  '#69db7c',
  '#1864ab',
  '#4dabf7',
  '#5f3dc4',
  '#b197fc',
  '#d6336c',
];

export const SIZES = [4, 10, 20, 36];

export interface ShapeTool {
  id: 'line' | 'square' | 'rect' | 'circle' | 'ellipse' | 'triangle';
  /** Sunucuya giden şekil türü. */
  kind: ShapeKind;
  /** En ve boy eşit tutulsun mu (kare, daire). */
  equal: boolean;
  title: string;
  /** 24x24 SVG içinde çizilecek yol. */
  svg: { tag: 'path' | 'rect' | 'circle' | 'ellipse'; attrs: Record<string, string | number> };
}

export const SHAPE_TOOLS: readonly ShapeTool[] = [
  { id: 'line', kind: 'line', equal: false, title: 'Düz çizgi', svg: { tag: 'path', attrs: { d: 'M5 19 L19 5' } } },
  {
    id: 'square',
    kind: 'rect',
    equal: true,
    title: 'Kare',
    svg: { tag: 'rect', attrs: { x: 5, y: 5, width: 14, height: 14, rx: 1 } },
  },
  {
    id: 'rect',
    kind: 'rect',
    equal: false,
    title: 'Dikdörtgen',
    svg: { tag: 'rect', attrs: { x: 3, y: 7.5, width: 18, height: 9, rx: 1 } },
  },
  { id: 'circle', kind: 'ellipse', equal: true, title: 'Daire', svg: { tag: 'circle', attrs: { cx: 12, cy: 12, r: 7.5 } } },
  {
    id: 'ellipse',
    kind: 'ellipse',
    equal: false,
    title: 'Elips',
    svg: { tag: 'ellipse', attrs: { cx: 12, cy: 12, rx: 9.5, ry: 5.5 } },
  },
  {
    id: 'triangle',
    kind: 'triangle',
    equal: false,
    title: 'Üçgen',
    svg: { tag: 'path', attrs: { d: 'M12 4.5 L20 19 L4 19 Z' } },
  },
];

export type Tool = 'pen' | 'eraser' | 'fill' | ShapeTool['id'];

export const findShapeTool = (tool: Tool): ShapeTool | undefined => SHAPE_TOOLS.find((s) => s.id === tool);
