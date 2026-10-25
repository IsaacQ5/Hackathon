import { existsSync } from 'node:fs';
import { createServer as createHttpServer, type Server as HttpServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';
import { GAME_CONFIG, type GameConfig } from '@tilt-mayhem/shared';
import { RoomManager, type RoomManagerOptions } from './rooms/RoomManager.js';
import { registerSocketHandlers, startGameLoop, type IOServer } from './socket/handlers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
/** apps/server/{src|dist} -> apps/web/dist */
const DEFAULT_WEB_DIST = path.resolve(here, '../../web/dist');

export interface AppOptions {
  gameConfig?: Partial<GameConfig>;
  rooms?: Omit<RoomManagerOptions, 'gameConfig'>;
  /** Allowed cross-origin URLs. Leave empty when the server serves the frontend. */
  corsOrigins?: string[];
  /** Built frontend directory. Set to null to disable static serving. */
  staticDir?: string | null;
}

export interface AppHandle {
  httpServer: HttpServer;
  io: IOServer;
  rooms: RoomManager;
  close(): Promise<void>;
}

export function createAppServer(options: AppOptions = {}): AppHandle {
  const gameConfig: GameConfig = { ...GAME_CONFIG, ...options.gameConfig };
  const app = express();
  app.disable('x-powered-by');

  app.get('/health', (_req, res) => {
    res.json({ ok: true, rooms: rooms.roomCount, uptimeSec: Math.round(process.uptime()) });
  });

  const staticDir = options.staticDir === undefined ? DEFAULT_WEB_DIST : options.staticDir;
  if (staticDir && existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir, { index: false, maxAge: '1h' }));
    // Client-side routes (/host/ABCD, /play/ABCD, /) all load the SPA.
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/socket.io')) return next();
      res.setHeader('Cache-Control', 'no-cache');
      res.sendFile(path.join(staticDir, 'index.html'));
    });
  } else if (staticDir) {
    app.get('/', (_req, res) => {
      res
        .type('text')
        .send('Sizzle Scramble server is running. Build the web app (npm run build) or use the Vite dev server.');
    });
  }

  const httpServer = createHttpServer(app);
  const cors = options.corsOrigins && options.corsOrigins.length > 0 ? { origin: options.corsOrigins } : undefined;
  const io: IOServer = new Server(httpServer, {
    cors,
    pingInterval: 10_000,
    pingTimeout: 8_000,
    maxHttpBufferSize: 16 * 1024, // payloads are tiny; refuse anything large
  });

  const rooms = new RoomManager({ ...options.rooms, gameConfig });
  registerSocketHandlers(io, rooms);
  const loop = startGameLoop(io, rooms, 1000 / gameConfig.tickRate);

  return {
    httpServer,
    io,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        loop.stop();
        void io.close(() => resolve());
      }),
  };
}
