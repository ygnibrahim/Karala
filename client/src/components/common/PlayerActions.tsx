// Oyuncu listelerindeki "⋯" butonu: sessize al, bildir ve (oda sahibi için) odadan çıkar.
// Menü ekranın ortasında açılır: kaydırılan dar listelerde kesilmez.
import type { ReportReason } from '@shared';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { type Key, useT } from '../../i18n';
import { toggleMuted, useMuted } from '../../lib/muted';
import { socket } from '../../lib/socket';

interface Props {
  /** Bakan kişi oda sahibi mi? */
  viewerIsHost: boolean;
  viewerId: string;
  targetId: string;
  targetName: string;
}

const REASONS: { id: ReportReason; label: Key }[] = [
  { id: 'abuse', label: 'report.abuse' },
  { id: 'drawing', label: 'report.drawing' },
  { id: 'spam', label: 'report.spam' },
  { id: 'other', label: 'report.other' },
];

export default function PlayerActions({ viewerIsHost, viewerId, targetId, targetName }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const muted = useMuted();
  if (viewerId === targetId) return null;
  const isMuted = muted.has(targetId);

  return (
    <>
      {isMuted && (
        <span className="muted-badge" title={t('actions.muted')}>
          🔇
        </span>
      )}
      <button
        type="button"
        className="kick-btn"
        title={t('actions.options', { name: targetName })}
        aria-label={t('actions.options', { name: targetName })}
        aria-haspopup="dialog"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        ⋯
      </button>
      {open &&
        createPortal(
          <ActionSheet
            name={targetName}
            isMuted={isMuted}
            canKick={viewerIsHost}
            onMute={() => toggleMuted(targetId)}
            onReport={(reason) => socket.emit('player:report', targetId, reason)}
            onKick={() => socket.emit('room:kick', targetId)}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

interface SheetProps {
  name: string;
  isMuted: boolean;
  canKick: boolean;
  onMute: () => void;
  onReport: (reason: ReportReason) => void;
  onKick: () => void;
  onClose: () => void;
}

function ActionSheet({ name, isMuted, canKick, onMute, onReport, onKick, onClose }: SheetProps) {
  const t = useT();
  const [step, setStep] = useState<'menu' | 'report' | 'kick'>('menu');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const done = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div className="sheet-layer">
      {/* Arka plana dokununca kapanır (klavyede Escape). */}
      <button type="button" className="sheet-backdrop" aria-label={t('common.close')} tabIndex={-1} onClick={onClose} />
      <div className="card sheet" role="dialog" aria-modal="true" aria-label={t('actions.options', { name })}>
        <h3 className="sheet-title">{name}</h3>
        {step === 'menu' && (
          <div className="sheet-actions">
            <button type="button" className="btn btn-secondary" onClick={done(onMute)}>
              {isMuted ? t('actions.unmute') : t('actions.mute')}
            </button>
            <p className="muted small">{isMuted ? t('actions.unmuteHint') : t('actions.muteHint')}</p>
            <button type="button" className="btn btn-ghost sheet-danger" onClick={() => setStep('report')}>
              {t('actions.report')}
            </button>
            {canKick && (
              <button type="button" className="btn btn-ghost sheet-danger" onClick={() => setStep('kick')}>
                {t('actions.kick')}
              </button>
            )}
          </div>
        )}
        {step === 'report' && (
          <div className="sheet-actions">
            <p className="small">{t('actions.reportWhy')}</p>
            {REASONS.map((r) => (
              <button key={r.id} type="button" className="btn btn-secondary" onClick={done(() => onReport(r.id))}>
                {t(r.label)}
              </button>
            ))}
          </div>
        )}
        {step === 'kick' && (
          <div className="sheet-actions">
            <p className="small">{t('actions.kickConfirm', { name })}</p>
            <button type="button" className="btn btn-primary" onClick={done(onKick)}>
              {t('actions.kickYes')}
            </button>
          </div>
        )}
        <button type="button" className="btn btn-ghost" onClick={step === 'menu' ? onClose : () => setStep('menu')}>
          {step === 'menu' ? t('common.close') : t('common.back')}
        </button>
      </div>
    </div>
  );
}
