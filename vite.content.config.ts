import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// MV3 content scripts cannot be ES modules, so this entry is bundled
// standalone as a single self-contained IIFE at dist/content.js.
export default defineConfig({
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'chrome110',
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/main.ts'),
      formats: ['iife'],
      name: 'WebContentBlocker',
      fileName: () => 'content.js',
    },
  },
});
