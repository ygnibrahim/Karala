// HTTP + Socket.IO sunucusunu kurar. Dinlemeye başlamaz: bunu index.ts (ya da testler) yapar.
import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import { sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ClientToServer, ServerToClient } from '@shared';
import express from 'express';
import helmet from 'helmet';
import { Server } from 'socket.io';
import { CORS_ORIGINS, IS_HOSTED, SERVER_LIMITS, VERSION } from './config';
import type { IO } from './game/Room';
import { RoomManager } from './game/RoomManager';
import { registerHandlers } from './socket/registerHandlers';

export interface KaralaServer {
  httpServer: HttpServer;
  io: IO;
  rooms: RoomManager;
  close(): Promise<void>;
}

const CLIENT_DIST = fileURLToPath(new URL('../../client/dist', import.meta.url));

export function createKaralaServer({ serveClient = true } = {}): KaralaServer {
  const app = express();
  app.disable('x-powered-by');
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          // React'in style={...} öznitelikleri satır içi stil gerektirir.
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          imgSrc: ["'self'", 'data:'],
          connectSrc: ["'self'", 'ws:', 'wss:'],
          workerSrc: ["'self'"],
          manifestSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          // Sadece HTTPS'te (Render) anlamlı; yerelde http ile test ederken kaynakları bozmasın.
          upgradeInsecureRequests: IS_HOSTED ? [] : null,
        },
      },
      // Google Fonts gibi dış kaynaklar CORP başlığı göndermediği için kapalı.
      crossOriginEmbedderPolicy: false,
    }),
  );

  const httpServer = createServer(app);
  const io: IO = new Server<ClientToServer, ServerToClient>(httpServer, {
    cors: { origin: CORS_ORIGINS?.length ? CORS_ORIGINS : true },
    maxHttpBufferSize: SERVER_LIMITS.maxMessageBytes,
  });
  const rooms = new RoomManager(io);
  registerHandlers(io, rooms);

  // Barındırma servisinin "sunucu ayakta mı?" kontrolü.
  app.get('/health', (_req, res) => {
    res.json({ ok: true, version: VERSION, rooms: rooms.size });
  });

  // Derlenmiş istemciyi de aynı adresten sun.
  if (serveClient && existsSync(CLIENT_DIST)) {
    app.use(
      express.static(CLIENT_DIST, {
        setHeaders(res, path) {
          // İçerik özetli dosyalar hiç değişmez; sw.js ve index.html her zaman taze alınmalı.
          if (path.includes(`${sep}assets${sep}`)) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          else res.setHeader('Cache-Control', 'no-cache');
        },
      }),
    );
    app.get(/.*/, (_req, res) => res.sendFile('index.html', { root: CLIENT_DIST }));
  }

  return {
    httpServer,
    io,
    rooms,
    async close() {
      rooms.closeAll();
      await io.close();
    },
  };
}
