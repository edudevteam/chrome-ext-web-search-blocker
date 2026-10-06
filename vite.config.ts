import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Builds the extension pages + service worker (ES modules are fine in both).
// The content script is built separately as an IIFE — see vite.content.config.ts.
export default defineConfig({
  plugins: [react()],
  define: {
    // Shown next to the version so two builds in the same minute are still
    // distinguishable when checking that a reload took effect.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome110',
    rollupOptions: {
      input: {
        index: resolve(import.meta.dirname, 'index.html'),
        options: resolve(import.meta.dirname, 'options.html'),
        blocked: resolve(import.meta.dirname, 'blocked.html'),
        newtab: resolve(import.meta.dirname, 'newtab.html'),
        background: resolve(import.meta.dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
});
