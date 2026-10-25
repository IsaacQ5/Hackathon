import { networkInterfaces } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAppServer } from './app.js';

// Load the repo-root .env if present (Node >= 20.12 has process.loadEnvFile).
const here = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.resolve(here, '../../../.env'));
} catch {
  /* no .env file: fine */
}

const port = Number(process.env.PORT) || 3000;
const minPlayers = Number(process.env.MIN_PLAYERS);
const corsOrigins = (process.env.CORS_ORIGIN ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const server = createAppServer({
  gameConfig: Number.isInteger(minPlayers) && minPlayers >= 1 ? { minPlayers } : {},
  corsOrigins,
});

server.httpServer.listen(port, '0.0.0.0', () => {
  console.log(`\n  Sizzle Scramble server on http://localhost:${port}`);
  for (const list of Object.values(networkInterfaces())) {
    for (const net of list ?? []) {
      if (net.family === 'IPv4' && !net.internal) console.log(`  LAN:  http://${net.address}:${port}`);
    }
  }
  console.log('');
});

const shutdown = () => {
  console.log('Shutting down...');
  void server.close().then(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
