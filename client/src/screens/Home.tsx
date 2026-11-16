import { useState } from 'react';
import { AVATAR_COLORS, AVATAR_FACES } from '../../../shared/protocol';
import AvatarBadge from '../components/AvatarBadge';
import SoundToggle from '../components/SoundToggle';
import { play } from '../sound';
import type { Profile } from '../session';

interface Props {
  profile: Profile;
  onProfile: (p: Profile) => void;
  initialCode: string | null;
  busy: boolean;
  error: string | null;
  onCreate: () => void;
  onJoin: (code: string) => void;
}

export default function Home({ profile, onProfile, initialCode, busy, error, onCreate, onJoin }: Props) {
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
      <SoundToggle className="corner" />
      <h1 className="logo">
        Kara<span>la</span> <span className="logo-icon">✏️</span>
      </h1>
      <p className="tagline">Çiz, tahmin et, kahkahayı bas!</p>

      <div className="card home-card">
        <div className="avatar-picker">
          <button className="icon-btn" onClick={() => cycleFace(-1)} aria-label="Önceki yüz">‹</button>
          <span key={profile.avatar.face + profile.avatar.color} className="bounce-in">
            <AvatarBadge avatar={profile.avatar} size={88} />
          </span>
          <button className="icon-btn" onClick={() => cycleFace(1)} aria-label="Sonraki yüz">›</button>
        </div>
        <div className="swatches">
          {AVATAR_COLORS.map((c) => (
            <button
              key={c}
              className={'swatch' + (c === profile.avatar.color ? ' active' : '')}
              style={{ background: c }}
              onClick={() => onProfile({ ...profile, avatar: { ...profile.avatar, color: c } })}
              aria-label={`Renk ${c}`}
            />
          ))}
        </div>

        <input
          className="input"
          placeholder="Takma adın"
          maxLength={16}
          value={profile.name}
          onChange={(e) => onProfile({ ...profile, name: e.target.value })}
        />

        {error && <div className="error">{error}</div>}

        {initialCode ? (
          <>
            <button className="btn btn-primary btn-big" disabled={!nameOk || busy} onClick={() => onJoin(initialCode)}>
              {initialCode} odasına katıl
            </button>
            <button className="btn btn-ghost" disabled={!nameOk || busy} onClick={onCreate}>
              Yoksa yeni oda kur
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary btn-big" disabled={!nameOk || busy} onClick={onCreate}>
              🎨 Oda Kur
            </button>
            <div className="divider"><span>ya da</span></div>
            <div className="join-row">
              <input
                className="input code-input"
                placeholder="ODA KODU"
                maxLength={5}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && nameOk && codeOk && onJoin(code)}
              />
              <button className="btn btn-secondary" disabled={!nameOk || !codeOk || busy} onClick={() => onJoin(code)}>
                Katıl
              </button>
            </div>
          </>
        )}
        {!nameOk && <p className="muted small">Başlamak için bir takma ad yaz.</p>}
      </div>

      <div className="how">
        <div><b>1.</b> Oda kur, linki arkadaşlarına at</div>
        <div><b>2.</b> Sırası gelen gizli kelimeyi çizer</div>
        <div><b>3.</b> Diğerleri en hızlı tahmin etmeye çalışır</div>
      </div>
    </div>
  );
}
