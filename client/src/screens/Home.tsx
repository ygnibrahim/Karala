import { AVATAR_COLORS, AVATAR_FACES, type ErrorCode, LANGUAGES } from '@shared';
import { useState } from 'react';
import AvatarBadge from '../components/common/AvatarBadge';
import InstallButton from '../components/common/InstallButton';
import SoundToggle from '../components/common/SoundToggle';
import { play } from '../effects/sound';
import { setLang, useLang, useT } from '../i18n';
import { clearLocalData, type Profile } from '../lib/session';

/** Ana ekranda gösterilebilecek hatalar: sunucunun kodları + istemcinin kendi durumları. */
export type HomeError = ErrorCode | 'unreachable' | 'kickedByHost';

interface Props {
  profile: Profile;
  onProfile: (p: Profile) => void;
  initialCode: string | null;
  busy: boolean;
  error: HomeError | null;
  onCreate: () => void;
  onJoin: (code: string) => void;
}

export default function Home({ profile, onProfile, initialCode, busy, error, onCreate, onJoin }: Props) {
  const t = useT();
  const lang = useLang();
  const [code, setCode] = useState(initialCode ?? '');
  const nameOk = profile.name.trim().length > 0;
  const codeOk = code.trim().length === 5;

  const cycleFace = (dir: number) => {
    const i = AVATAR_FACES.indexOf(profile.avatar.face);
    const face = AVATAR_FACES[(i + dir + AVATAR_FACES.length) % AVATAR_FACES.length];
    onProfile({ ...profile, avatar: { ...profile.avatar, face } });
    play('pop');
  };

  return (
    <div className="home">
      <div className="corner home-corner">
        <fieldset className="lang-switch" aria-label={t('lang.switch')}>
          {LANGUAGES.map((l) => (
            <button
              type="button"
              key={l}
              className={l === lang ? 'active' : ''}
              aria-pressed={l === lang}
              title={t(`lang.${l}`)}
              onClick={() => setLang(l)}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </fieldset>
        <SoundToggle />
      </div>
      <h1 className="logo">
        Kara<span>la</span> <span className="logo-icon">✏️</span>
      </h1>
      <p className="tagline">{t('home.tagline')}</p>

      <div className="card home-card">
        <div className="avatar-picker">
          <button type="button" className="icon-btn" onClick={() => cycleFace(-1)} aria-label={t('home.prevFace')}>
            ‹
          </button>
          <span key={profile.avatar.face + profile.avatar.color} className="bounce-in">
            <AvatarBadge avatar={profile.avatar} size={88} />
          </span>
          <button type="button" className="icon-btn" onClick={() => cycleFace(1)} aria-label={t('home.nextFace')}>
            ›
          </button>
        </div>
        <div className="swatches">
          {AVATAR_COLORS.map((c) => (
            <button
              type="button"
              key={c}
              className={`swatch${c === profile.avatar.color ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => onProfile({ ...profile, avatar: { ...profile.avatar, color: c } })}
              aria-label={t('common.color', { color: c })}
            />
          ))}
        </div>

        <input
          className="input"
          placeholder={t('home.nickname')}
          maxLength={16}
          value={profile.name}
          onChange={(e) => onProfile({ ...profile, name: e.target.value })}
        />

        {error && <div className="error">{t(`error.${error}`)}</div>}

        {initialCode ? (
          <>
            <button
              type="button"
              className="btn btn-primary btn-big"
              disabled={!nameOk || busy}
              onClick={() => onJoin(initialCode)}
            >
              {t('home.joinRoom', { code: initialCode })}
            </button>
            <button type="button" className="btn btn-ghost" disabled={!nameOk || busy} onClick={onCreate}>
              {t('home.orCreate')}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-big" disabled={!nameOk || busy} onClick={onCreate}>
              {t('home.create')}
            </button>
            <div className="divider">
              <span>{t('home.or')}</span>
            </div>
            <div className="join-row">
              <input
                className="input code-input"
                placeholder={t('home.codePlaceholder')}
                maxLength={5}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && nameOk && codeOk && onJoin(code)}
              />
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!nameOk || !codeOk || busy}
                onClick={() => onJoin(code)}
              >
                {t('home.join')}
              </button>
            </div>
          </>
        )}
        {!nameOk && <p className="muted small">{t('home.needName')}</p>}
      </div>

      <InstallButton />

      <div className="how">
        <div>
          <b>1.</b> {t('home.how1')}
        </div>
        <div>
          <b>2.</b> {t('home.how2')}
        </div>
        <div>
          <b>3.</b> {t('home.how3')}
        </div>
      </div>

      <footer className="home-footer">
        <span>{t('home.privacyNote')}</span>
        <span className="home-footer-links">
          <a href={lang === 'tr' ? '/gizlilik.html' : '/privacy.html'} target="_blank" rel="noopener">
            {t('home.privacy')}
          </a>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              if (!confirm(t('home.deleteConfirm'))) return;
              clearLocalData();
              window.location.reload();
            }}
          >
            {t('home.deleteData')}
          </button>
        </span>
      </footer>
    </div>
  );
}
