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

  // `maplibre-gl` starts a worker to turn source data into tiles. Pre-bundled by esbuild for
  // the development server, that worker never starts: the raster basemap still draws, because
  // it needs no worker, and every vector layer stays empty while `isStyleLoaded()` never turns
  // true. Nothing is logged. Excluding the package from the pre-bundling repairs it.
  optimizeDeps: { exclude: ['maplibre-gl'] },
});
