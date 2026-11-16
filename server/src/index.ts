// Sunucunun giriş noktası.
import { createKaralaServer } from './app';
import { PORT } from './config';

const server = createKaralaServer();

server.httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 Karala sunucusu çalışıyor: http://localhost:${PORT}`);
});

// Barındırma servisi kapatırken açık bağlantıları düzgünce kapat.
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close().finally(() => process.exit(0));
  });
}
