// Oda ayarları. Oda sahibi değiştirebilir, diğerleri sadece görür.
import {
  CATEGORIES,
  CUSTOM_ONLY_CATEGORY,
  DRAW_TIME_OPTIONS,
  GAME_MODES,
  LIMITS,
  MAX_PLAYER_OPTIONS,
  type PublicSettings,
  ROUND_OPTIONS,
  type Settings,
} from '@shared';
import { useEffect, useRef, useState } from 'react';
import { socket } from '../../lib/socket';

interface Props {
  settings: PublicSettings;
  isHost: boolean;
  /** Sadece oda sahibinde dolu gelir. */
  customWords: string[];
  connectedCount: number;
}

export default function SettingsPanel({ settings: s, isHost, customWords, connectedCount }: Props) {
  const [wordsText, setWordsText] = useState(customWords.join(', '));
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sunucudan gelen liste değişince (ör. yeniden bağlanınca) yazılanı güncelle; yazarken bozma.
  useEffect(() => {
    if (document.activeElement !== textareaRef.current) setWordsText(customWords.join(', '));
  }, [customWords]);

  const update = (patch: Partial<Settings>) => socket.emit('room:settings', patch);
  const customOnly = s.category === CUSTOM_ONLY_CATEGORY;
  const mode = GAME_MODES.find((m) => m.id === s.mode) ?? GAME_MODES[0];
  const telephone = s.mode === 'telephone';
  const enoughPlayers = connectedCount >= mode.minPlayers;
  const canStart = enoughPlayers && (!customOnly || s.customWordCount >= 3);

  return (
    <section className="card">
      <h2>Ayarlar {!isHost && <span className="muted small">(oda sahibi değiştirebilir)</span>}</h2>
      <fieldset className="modes" aria-label="Oyun modu" disabled={!isHost}>
        {GAME_MODES.map((m) => (
          <button
            type="button"
            key={m.id}
            className={`mode${m.id === s.mode ? ' active' : ''}`}
            aria-pressed={m.id === s.mode}
            onClick={() => update({ mode: m.id })}
          >
            <b>{m.name}</b>
            <span>{m.description}</span>
            <small>en az {m.minPlayers} oyuncu</small>
          </button>
        ))}
      </fieldset>
      <div className="settings">
        {!telephone && (
          <NumberSelect
            label="Tur sayısı"
            value={s.rounds}
            options={ROUND_OPTIONS}
            disabled={!isHost}
            onChange={(rounds) => update({ rounds })}
          />
        )}
        <NumberSelect
          label={telephone ? 'Çizim adımı süresi' : 'Çizim süresi'}
          value={s.drawTime}
          options={DRAW_TIME_OPTIONS}
          suffix=" sn"
          disabled={!isHost}
          onChange={(drawTime) => update({ drawTime })}
        />
        <label>
          {telephone ? 'Öneri kategorisi' : 'Kategori'}
          <select disabled={!isHost} value={s.category} onChange={(e) => update({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <NumberSelect
          label="En fazla oyuncu"
          value={s.maxPlayers}
          options={MAX_PLAYER_OPTIONS}
          disabled={!isHost}
          onChange={(maxPlayers) => update({ maxPlayers })}
        />

        {isHost ? (
          <label className="wide">
            Özel kelimeler <span className="muted small">(virgülle ayır · {s.customWordCount} kelime · sadece sen görürsün)</span>
            <textarea
              ref={textareaRef}
              rows={3}
              maxLength={LIMITS.customWordCount * (LIMITS.customWordLength + 2)}
              placeholder="ör. Ahmet'in arabası, kampüs kantini, yaz tatili"
              value={wordsText}
              onChange={(e) => setWordsText(e.target.value)}
              onBlur={() => update({ customWords: wordsText.split(/[,\n]/) })}
            />
          </label>
        ) : (
          s.customWordCount > 0 && (
            <p className="wide muted small">🤫 Oda sahibi {s.customWordCount} özel kelime ekledi. Sürpriz olsun diye gizli!</p>
          )
        )}
      </div>

      {isHost ? (
        <button type="button" className="btn btn-primary btn-big" disabled={!canStart} onClick={() => socket.emit('game:start')}>
          ▶ Oyunu Başlat
        </button>
      ) : (
        <p className="waiting">Oda sahibinin oyunu başlatması bekleniyor…</p>
      )}
      {isHost && !enoughPlayers && (
        <p className="muted small center">
          {mode.name} için en az {mode.minPlayers} oyuncu gerekli. Davet linkini paylaş!
        </p>
      )}
      {isHost && customOnly && s.customWordCount < 3 && (
        <p className="muted small center">Sadece özel kelimelerle oynamak için en az 3 kelime ekle.</p>
      )}
    </section>
  );
}

interface NumberSelectProps {
  label: string;
  value: number;
  options: readonly number[];
  suffix?: string;
  disabled: boolean;
  onChange: (value: number) => void;
}

function NumberSelect({ label, value, options, suffix = '', disabled, onChange }: NumberSelectProps) {
  return (
    <label>
      {label}
      <select disabled={disabled} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {options.map((n) => (
          <option key={n} value={n}>
            {n}
            {suffix}
          </option>
        ))}
      </select>
    </label>
  );
}
