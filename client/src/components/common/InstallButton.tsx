import { useState } from 'react';
import { useT } from '../../i18n';
import { useInstall } from '../../lib/pwa';

export default function InstallButton() {
  const t = useT();
  const { mode, install } = useInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (!mode) return null;

  if (mode === 'ios') {
    return (
      <div className="install">
        <button type="button" className="btn btn-install" onClick={() => setShowIosHelp((v) => !v)}>
          {t('home.addToHome')}
        </button>
        {showIosHelp && <p className="install-help">{t('home.iosHelp')}</p>}
      </div>
    );
  }

  return (
    <div className="install">
      <button type="button" className="btn btn-install" onClick={install}>
        {t('home.install')}
      </button>
    </div>
  );
}
