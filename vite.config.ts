import path from 'node:path';
import { tanstackRouter } from '@tanstack/router-plugin/vite';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

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

  // External constraint: the proxy keeps the Host of the page, port 5173 by default, and the
  // writer admits only the names it knows. A change of this port refuses every write until the
  // writer admits the new Host. The writer holds its own rule on the sender.
  server: { proxy: { '/write': 'http://127.0.0.1:5177' } },

  // Departure: the bundler warns above 500 kB, and the map chunk is over 900 kB by nature.
  build: { chunkSizeWarningLimit: Infinity },

  // External constraint: pre-bundled by esbuild, the tile worker of `maplibre-gl` never starts.
  // The raster basemap draws, each vector layer stays empty, `isStyleLoaded()` never turns true,
  // and nothing is logged. Excluding the package from the pre-bundling repairs it.
  optimizeDeps: { exclude: ['maplibre-gl'] },
});
