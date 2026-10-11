import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// The streaming-site content script, bundled standalone as an IIFE at
// dist/stream.js for the same reason as vite.content.config.ts.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome110',
    lib: {
      entry: resolve(import.meta.dirname, 'src/stream/main.ts'),
      formats: ['iife'],
      name: 'WebContentBlockerStream',
      fileName: () => 'stream.js',
    },
  },
});
