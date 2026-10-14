import { readFileSync } from 'node:fs';
import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { openWithKey } from './tools/dev-open.ts';

// External constraint: the key of the operator lives in infra/.env, and only the operator side
// reads that file. No file, as in CI, gives no key and so opens no browser.
const envText = (): string | undefined => {
  try {
    return readFileSync(path.resolve(import.meta.dirname, 'infra/.env'), 'utf8');
  } catch {
    return undefined;
  }
};

export default defineConfig({
  plugins: [
    // External constraint: TanStack Router requires this plugin before the React plugin. The
    // router plugin rewrites the route files, and the React plugin must see the result.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },

  // External constraint: a proxy given as a text sends the Host of its target, so the writer
  // reads its own Host. The browser sends the Origin of the page, port 5173 by default, and the
  // writer admits only the origins it knows. A change of this port refuses every write until the
  // writer admits the new origin. The proxy adds no key: any local process can reach it, so the
  // browser of the operator holds the key and the writer checks it.
  server: {
    open: openWithKey(envText(), process.env['npm_lifecycle_event']),
    proxy: { '/write': 'http://127.0.0.1:5177', '/private': 'http://127.0.0.1:5177' },
  },

  // Departure: the bundler warns above 500 kB, and the map chunk is over 900 kB by nature.
  build: { chunkSizeWarningLimit: Infinity },

  // External constraint: pre-bundled by esbuild, the tile worker of `maplibre-gl` never starts.
  // The raster basemap draws, each vector layer stays empty, `isStyleLoaded()` never turns true,
  // and nothing is logged. Excluding the package from the pre-bundling repairs it.
  optimizeDeps: { exclude: ['maplibre-gl'] },
});
