// Android uygulamasında geri tuşu / geri hareketi. Capacitor bunu kendisi yakalamaz; yakalanmazsa
// uygulama direkt kapanır (oyuncu oyunun ortasında odadan düşer).
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { useEffect, useRef } from 'react';

interface Options {
  inRoom: boolean;
  /** Odadan çıkmadan önce sorulacak soru. */
  confirmText: string;
  leave: () => void;
}

/**
 * Sırasıyla: açık bir pencere (QR, oyuncu menüsü, galeri…) varsa onu kapatır; odadaysa çıkmak isteyip
 * istemediğini sorar; ana ekrandaysa uygulamayı kapatmak yerine arka plana alır.
 */
export function useNativeBack({ inRoom, confirmText, leave }: Options): void {
  const latest = useRef({ inRoom, confirmText, leave });
  latest.current = { inRoom, confirmText, leave };

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const handle = App.addListener('backButton', () => {
      // Pencereler (Sheet, oyuncu menüsü) Escape ile kapanır; aynı yolu kullan.
      if (document.querySelector('.sheet-layer')) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
        return;
      }
      const { inRoom, confirmText, leave } = latest.current;
      if (inRoom) {
        if (window.confirm(confirmText)) leave();
        return;
      }
      void App.minimizeApp();
    });
    return () => {
      void handle.then((h) => h.remove());
    };
  }, []);
}
