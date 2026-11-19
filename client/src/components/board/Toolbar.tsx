// Çizen oyuncunun araç çubuğu: renkler, şekiller, kalınlık ve araçlar.
import { createElement } from 'react';
import { useT } from '../../i18n';
import { COLORS, SHAPE_TOOLS, SIZES, type Tool } from './tools';

interface Props {
  tool: Tool;
  color: string;
  size: number;
  onTool: (t: Tool) => void;
  onColor: (c: string) => void;
  onSize: (s: number) => void;
  onUndo: () => void;
  onClear: () => void;
  /** Geri alma ve temizleme butonlarını gizle. */
  noEditing?: boolean;
}

export default function Toolbar({ tool, color, size, onTool, onColor, onSize, onUndo, onClear, noEditing = false }: Props) {
  const t = useT();
  // Beyaz seçiliyken ikonlar görünsün diye gri göster.
  const iconColor = color === '#ffffff' ? '#adb5bd' : color;

  return (
    <div className="toolbar">
      <div className="colors">
        {COLORS.map((c) => (
          <button
            type="button"
            key={c}
            className={`color${c === color && tool !== 'eraser' ? ' active' : ''}`}
            style={{ background: c }}
            aria-label={t('common.color', { color: c })}
            onClick={() => {
              onColor(c);
              if (tool === 'eraser') onTool('pen');
            }}
          />
        ))}
      </div>

      <fieldset className="shapes" aria-label={t('board.shapes')}>
        {SHAPE_TOOLS.map((s) => (
          <button
            type="button"
            key={s.id}
            className={`shape${tool === s.id ? ' active' : ''}`}
            onClick={() => onTool(s.id)}
            title={t(`shape.${s.id}`)}
            aria-label={t(`shape.${s.id}`)}
          >
            <svg
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke={iconColor}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {createElement(s.svg.tag, s.svg.attrs)}
            </svg>
          </button>
        ))}
      </fieldset>

      <div className="tool-group">
        {SIZES.map((n) => (
          <button
            type="button"
            key={n}
            className={`tool size${n === size ? ' active' : ''}`}
            onClick={() => onSize(n)}
            aria-label={t('board.size', { n })}
          >
            <span
              style={{
                width: Math.max(4, n / 1.6),
                height: Math.max(4, n / 1.6),
                background: tool === 'eraser' ? '#adb5bd' : color,
              }}
            />
          </button>
        ))}
      </div>

      <div className="tool-group">
        <ToolButton active={tool === 'pen'} onClick={() => onTool('pen')} title={t('board.pen')} icon="✏️" />
        <ToolButton active={tool === 'eraser'} onClick={() => onTool('eraser')} title={t('board.eraser')} icon="🧽" />
        <ToolButton active={tool === 'fill'} onClick={() => onTool('fill')} title={t('board.fill')} icon="🪣" />
      </div>

      {!noEditing && (
        <div className="tool-group">
          <ToolButton onClick={onUndo} title={t('board.undo')} icon="↶" />
          <ToolButton onClick={onClear} title={t('board.clear')} icon="🗑️" />
        </div>
      )}
    </div>
  );
}

function ToolButton({ active, onClick, title, icon }: { active?: boolean; onClick: () => void; title: string; icon: string }) {
  return (
    <button type="button" className={`tool${active ? ' active' : ''}`} onClick={onClick} title={title} aria-label={title}>
      {icon}
    </button>
  );
}
