import type { CapacitorConfig } from '@capacitor/cli';

// CAP_LIVE_URL verilirse uygulama, bilgisayardaki Vite sunucusunu canlı yükler
// (kod değiştikçe emülatörde anında güncellenir). Verilmezse derlenmiş 'dist' paketlenir.
const liveUrl = process.env.CAP_LIVE_URL;

const config: CapacitorConfig = {
  appId: 'com.karala.app',
  appName: 'Karala',
  webDir: 'dist',
  server: liveUrl ? { url: liveUrl, cleartext: true } : { androidScheme: 'https' },
};

export default config;
