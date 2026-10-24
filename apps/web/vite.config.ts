import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Read VITE_* variables from the repo-root .env
  envDir: '../../',
  server: {
    host: true, // listen on the LAN so phones can reach the dev server
    port: 5173,
    allowedHosts: true, // allow tunnel hostnames (cloudflared / ngrok) in dev
    proxy: {
      '/socket.io': { target: 'http://localhost:3000', ws: true },
      '/health': { target: 'http://localhost:3000' },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
