import { useState } from 'react';
import { useInstall } from '../pwa';

export default function InstallButton() {
  const { mode, install } = useInstall();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (!mode) return null;

  if (mode === 'ios') {
    return (
      <div className="install">
        <button className="btn btn-install" onClick={() => setShowIosHelp((v) => !v)}>
          📲 Ana ekrana ekle
        </button>
        {showIosHelp && (
          <p className="install-help">
            Safari'de alttaki <b>Paylaş</b> <span aria-hidden>⬆️</span> butonuna dokun, sonra <b>Ana Ekrana Ekle</b>'yi seç.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="install">
      <button className="btn btn-install" onClick={install}>
        📲 Uygulamayı yükle
      </button>
    </div>
  );
}
