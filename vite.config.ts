import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    // The TanStack Router documentation requires this plugin before the React plugin. It is
    // a stated requirement, not a preference: the router plugin rewrites the route files, and
    // the React plugin must see the result.
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },

  // The writer answers on the loopback address, and this proxy keeps the browser same-origin.
  // Same-origin decides who reads a reply and never who sends a request, so the writer holds
  // its own rule on the sender and this proxy replaces none of it.
  server: { proxy: { '/write': 'http://127.0.0.1:5177' } },

  // The bundler warns above 500 kB, and the map chunk is over 900 kB by nature, so that warning
  // printed on every build and reported nothing. `tools/bundle-guard.ts` runs after the build
  // and holds a ceiling per chunk instead, so a size that grows too far fails and never warns.
  build: { chunkSizeWarningLimit: Infinity },

  // `maplibre-gl` starts a worker to turn source data into tiles. Pre-bundled by esbuild for
  // the development server, that worker never starts: the raster basemap still draws, because
  // it needs no worker, and every vector layer stays empty while `isStyleLoaded()` never turns
  // true. Nothing is logged. Excluding the package from the pre-bundling repairs it.
  optimizeDeps: { exclude: ['maplibre-gl'] },
});
