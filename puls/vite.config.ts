import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build` -> normal PWA build in dist/
// `npm run build:single` -> one self-contained HTML file in dist-single/ (handy for sharing a preview)
export default defineConfig(({ mode }) => ({
  base: process.env.FRIS_BASE ?? './',
  plugins: [react(), ...(mode === 'single' ? [viteSingleFile()] : [])],
  build: {
    outDir: mode === 'single' ? 'dist-single' : 'dist',
    assetsInlineLimit: mode === 'single' ? 100_000_000 : 4096,
  },
  test: { environment: 'node' },
}));
