// Çizen oyuncunun araç çubuğu: renkler, şekiller, kalınlık ve araçlar.
import { createElement } from 'react';
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
            aria-label={`Renk ${c}`}
            onClick={() => {
              onColor(c);
              if (tool === 'eraser') onTool('pen');
            }}
          />
        ))}
      </div>

      <fieldset className="shapes" aria-label="Şekiller">
        {SHAPE_TOOLS.map((t) => (
          <button
            type="button"
            key={t.id}
            className={`shape${tool === t.id ? ' active' : ''}`}
            onClick={() => onTool(t.id)}
            title={t.title}
            aria-label={t.title}
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
              {createElement(t.svg.tag, t.svg.attrs)}
            </svg>
          </button>
        ))}
      </fieldset>

      <div className="tool-group">
        {SIZES.map((s) => (
          <button
            type="button"
            key={s}
            className={`tool size${s === size ? ' active' : ''}`}
            onClick={() => onSize(s)}
            aria-label={`Kalınlık ${s}`}
          >
            <span
              style={{
                width: Math.max(4, s / 1.6),
                height: Math.max(4, s / 1.6),
                background: tool === 'eraser' ? '#adb5bd' : color,
              }}
            />
          </button>
        ))}
      </div>

      <div className="tool-group">
        <ToolButton active={tool === 'pen'} onClick={() => onTool('pen')} title="Kalem" icon="✏️" />
        <ToolButton active={tool === 'eraser'} onClick={() => onTool('eraser')} title="Silgi" icon="🧽" />
        <ToolButton active={tool === 'fill'} onClick={() => onTool('fill')} title="Boya kovası" icon="🪣" />
      </div>

      {!noEditing && (
        <div className="tool-group">
          <ToolButton onClick={onUndo} title="Geri al" icon="↶" />
          <ToolButton onClick={onClear} title="Hepsini sil" icon="🗑️" />
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
