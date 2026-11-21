// Ortadaki küçük pencere: arka plana dokununca ya da Escape ile kapanır. body'ye taşınır (transform'lu
// atalar position: fixed'i bozmasın).
import { type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n';

interface Props {
  label: string;
  onClose: () => void;
  className?: string;
  children: ReactNode;
}

export default function Sheet({ label, onClose, className = '', children }: Props) {
  const t = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="sheet-layer">
      <button type="button" className="sheet-backdrop" aria-label={t('common.close')} tabIndex={-1} onClick={onClose} />
      <div className={`card sheet ${className}`} role="dialog" aria-modal="true" aria-label={label}>
        {children}
      </div>
    </div>,
    document.body,
  );
}
