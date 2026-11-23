import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';

const SERVER_PORT = Number(process.env.PORT || 3001);

/** Static (GitHub Pages) build: ship the word-game dictionary as a file the host fetches. */
function wordsFile(): Plugin {
  return {
    name: 'bloop-words',
    generateBundle() {
      const raw = fs.readFileSync(path.resolve(__dirname, 'node_modules/word-list/words.txt'), 'utf8');
      const words = raw.split('\n').filter((w) => w.length >= 2 && w.length <= 10 && /^[a-z]+$/.test(w));
      this.emitFile({ type: 'asset', fileName: 'words.txt', source: words.join('\n') });
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: path.resolve(__dirname, 'client'),
  // `vite build --mode pages` → https://<user>.github.io/<repo>/ with rooms hosted in the browser
  base: mode === 'pages' ? process.env.PAGES_BASE || '/partygame/' : '/',
  envDir: __dirname,
  publicDir: path.resolve(__dirname, 'client/public'),
  plugins: [react(), ...(mode === 'pages' ? [wordsFile()] : [])],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, 'shared'),
      // server modules that also run in the host's browser
      'word-list': path.resolve(__dirname, 'client/src/p2p/shims/word-list.ts'),
      'node:fs': path.resolve(__dirname, 'client/src/p2p/shims/fs.ts'),
    },
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': `http://localhost:${SERVER_PORT}`,
      '/socket.io': { target: `http://localhost:${SERVER_PORT}`, ws: true },
    },
  },
  build: {
    outDir: path.resolve(__dirname, mode === 'pages' ? 'dist/pages' : 'dist/client'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    target: 'es2020',
  },
}));
