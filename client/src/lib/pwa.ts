import { Capacitor } from '@capacitor/core';
import { useEffect, useState } from 'react';

// Chrome/Edge'in "uygulamayı yükle" olayı (standart tiplerde yok)
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => {
  for (const fn of listeners) fn();
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault(); // tarayıcının kendi küçük bildirimini değil, bizim butonumuzu göster
  deferred = e as InstallPromptEvent;
  notify();
});
window.addEventListener('appinstalled', () => {
  deferred = null;
  notify();
});

export function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    Capacitor.isNativePlatform()
  );
}

const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent) && !/CriOS|FxiOS/i.test(navigator.userAgent);

/** Servis çalışanını kaydet: sadece yayın sürümünde ve tarayıcıda (Capacitor uygulamasında değil). */
export function registerServiceWorker() {
  if (!import.meta.env.PROD || Capacitor.isNativePlatform() || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* desteklenmiyorsa uygulama yine çalışır */
    });
  });
}

export type InstallMode = 'prompt' | 'ios' | null;

/** Yükleme butonu gösterilmeli mi, gösterilecekse nasıl? */
export function useInstall(): { mode: InstallMode; install: () => Promise<void> } {
  const [, force] = useState(0);
  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);

  let mode: InstallMode = null;
  if (!isStandalone()) {
    if (deferred) mode = 'prompt';
    else if (isIOS()) mode = 'ios';
  }

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    notify();
  };

  return { mode, install };
}
