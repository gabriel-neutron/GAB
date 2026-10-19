// External constraint: MapLibre starts its worker from the address of its own module, with the name
// `maplibre-gl-worker.mjs` beside it, and that worker imports `maplibre-gl-shared.mjs` from beside
// itself. The bundler folds the module of MapLibre into a chunk and copies neither file, so the map
// of a built site has no worker and draws no vector layer. The build copies both files into the
// folder of the chunks, where the chunk of the map finds them.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Plugin } from 'vite';

const FILES = ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs'] as const;

export function maplibreWorker(): Plugin {
  return {
    name: 'gab-maplibre-worker',
    apply: 'build',
    generateBundle() {
      const folder = dirname(fileURLToPath(import.meta.resolve('maplibre-gl')));
      for (const name of FILES)
        this.emitFile({
          type: 'asset',
          fileName: `assets/${name}`,
          source: readFileSync(join(folder, name)),
        });
    },
  };
}
