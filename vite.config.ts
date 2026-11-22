import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const SERVER_PORT = Number(process.env.PORT || 3001);

export default defineConfig({
  root: path.resolve(__dirname, 'client'),
  publicDir: path.resolve(__dirname, 'client/public'),
  plugins: [react()],
  resolve: {
    alias: { '@shared': path.resolve(__dirname, 'shared') },
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
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
    target: 'es2020',
  },
});
