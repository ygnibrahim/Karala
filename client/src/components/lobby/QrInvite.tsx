// Lobide QR ile davet: yanındaki arkadaşın telefon kamerasıyla okutup doğrudan odaya katılır.
import { useMemo, useState } from 'react';
import { encode } from 'uqr';
import { useT } from '../../i18n';
import { inviteLink } from '../../lib/session';
import Sheet from '../common/Sheet';

/** QR'ı tek bir SVG yolu olarak çizer (her koyu kare bir "M x y h1 v1 h-1 z"). */
function QrSvg({ text }: { text: string }) {
  const { path, size } = useMemo(() => {
    const { data } = encode(text, { ecc: 'M', border: 2 });
    let d = '';
    data.forEach((row, y) => {
      row.forEach((dark, x) => {
        if (dark) d += `M${x} ${y}h1v1h-1z`;
      });
    });
    return { path: d, size: data.length };
  }, [text]);
  return (
    <svg className="qr" viewBox={`0 0 ${size} ${size}`} shapeRendering="crispEdges" aria-hidden="true">
      <rect width={size} height={size} fill="#fff" />
      <path d={path} fill="#1f1b3a" />
    </svg>
  );
}

export default function QrInvite({ code }: { code: string }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost btn-small" onClick={() => setOpen(true)} aria-label={t('lobby.qrTitle')}>
        {t('lobby.qr')}
      </button>
      {open && (
        <Sheet label={t('lobby.qrTitle')} className="qr-sheet" onClose={() => setOpen(false)}>
          <h3 className="sheet-title">{t('lobby.qrTitle')}</h3>
          <QrSvg text={inviteLink(code)} />
          <p className="muted small">{t('lobby.qrHint')}</p>
          <strong className="qr-code">{code}</strong>
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>
            {t('common.close')}
          </button>
        </Sheet>
      )}
    </>
  );
}
