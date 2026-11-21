// Oda ayarları. Oda sahibi değiştirebilir, diğerleri sadece görür.
import {
  CATEGORIES,
  CUSTOM_ONLY_CATEGORY,
  DRAW_TIME_OPTIONS,
  GAME_MODES,
  LANGUAGES,
  type Lang,
  LIMITS,
  MAX_PLAYER_OPTIONS,
  type PublicSettings,
  ROUND_OPTIONS,
  type Settings,
} from '@shared';
import { useEffect, useRef, useState } from 'react';
import { type Key, useT } from '../../i18n';
import { saveCustomWords } from '../../lib/customWords';
import { socket } from '../../lib/socket';

interface Props {
  settings: PublicSettings;
  isHost: boolean;
  /** Sadece oda sahibinde dolu gelir. */
  customWords: string[];
  connectedCount: number;
  /** Takım modunda her iki takımda da yeterli oyuncu var mı (diğer modlarda true). */
  teamsReady: boolean;
}

export default function SettingsPanel({ settings: s, isHost, customWords, connectedCount, teamsReady }: Props) {
  const t = useT();
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
  const canStart = enoughPlayers && teamsReady && (!customOnly || s.customWordCount >= 3);

  return (
    <section className="card">
      <h2>
        {t('settings.title')} {!isHost && <span className="muted small">{t('settings.hostOnly')}</span>}
      </h2>
      <fieldset className="modes" aria-label={t('settings.mode')} disabled={!isHost}>
        {GAME_MODES.map((m) => (
          <button
            type="button"
            key={m.id}
            className={`mode${m.id === s.mode ? ' active' : ''}`}
            aria-pressed={m.id === s.mode}
            onClick={() => update({ mode: m.id })}
          >
            <b>{t(`mode.${m.id}.name`)}</b>
            <span>{t(`mode.${m.id}.description`)}</span>
            <small>{t('settings.minPlayers', { n: m.minPlayers })}</small>
          </button>
        ))}
      </fieldset>
      <div className="settings">
        {!telephone && (
          <NumberSelect
            label={s.mode === 'teams' ? t('settings.drawsEach') : t('settings.rounds')}
            value={s.rounds}
            options={ROUND_OPTIONS}
            disabled={!isHost}
            onChange={(rounds) => update({ rounds })}
          />
        )}
        {s.mode !== 'impostor' && (
          <NumberSelect
            label={telephone ? t('settings.stepTime') : t('settings.drawTime')}
            value={s.drawTime}
            options={DRAW_TIME_OPTIONS}
            suffix={` ${t('common.seconds', { n: '' }).trim()}`}
            disabled={!isHost}
            onChange={(drawTime) => update({ drawTime })}
          />
        )}
        <label>
          {t('settings.wordLanguage')}
          <select disabled={!isHost} value={s.language} onChange={(e) => update({ language: e.target.value as Lang })}>
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {t(`lang.${l}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {telephone ? t('settings.promptCategory') : t('settings.category')}
          <select disabled={!isHost} value={s.category} onChange={(e) => update({ category: e.target.value })}>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {t(c.id === CUSTOM_ONLY_CATEGORY ? 'category.ozelOnly' : (`category.${c.id}` as Key))}
              </option>
            ))}
          </select>
        </label>
        <NumberSelect
          label={t('settings.maxPlayers')}
          value={s.maxPlayers}
          options={MAX_PLAYER_OPTIONS}
          disabled={!isHost}
          onChange={(maxPlayers) => update({ maxPlayers })}
        />

        {isHost ? (
          <label className="wide">
            {t('settings.customWords')}{' '}
            <span className="muted small">{t('settings.customWordsHint', { n: s.customWordCount })}</span>
            <textarea
              ref={textareaRef}
              rows={3}
              maxLength={LIMITS.customWordCount * (LIMITS.customWordLength + 2)}
              placeholder={t('settings.customWordsPlaceholder')}
              value={wordsText}
              onChange={(e) => setWordsText(e.target.value)}
              onBlur={() => {
                const words = wordsText.split(/[,\n]/);
                saveCustomWords(words);
                update({ customWords: words });
              }}
            />
          </label>
        ) : (
          s.customWordCount > 0 && <p className="wide muted small">{t('settings.customWordsHidden', { n: s.customWordCount })}</p>
        )}
      </div>

      {isHost ? (
        <button type="button" className="btn btn-primary btn-big" disabled={!canStart} onClick={() => socket.emit('game:start')}>
          {t('settings.start')}
        </button>
      ) : (
        <p className="waiting">{t('settings.waitingHost')}</p>
      )}
      {isHost && !enoughPlayers && (
        <p className="muted small center">{t('settings.needPlayers', { mode: t(`mode.${mode.id}.name`), n: mode.minPlayers })}</p>
      )}
      {isHost && enoughPlayers && !teamsReady && <p className="muted small center">{t('settings.teamsUnbalanced')}</p>}
      {isHost && customOnly && s.customWordCount < 3 && <p className="muted small center">{t('settings.needCustomWords')}</p>}
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
