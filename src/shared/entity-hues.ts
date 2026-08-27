// One reader for both canvases, because a feature never imports a feature.

import type { TypeVocabulary } from './read/model';

/** The light theme is on `:root`, the dark theme on `.dark`. */
export type HueTheme = 'light' | 'dark';

// A hue is a declared property of a type and never a position in a list. The declaration is what
// makes the two canvases agree, and what a new type does not disturb. The column holds hex:
// Sigma parses hex on the CPU, and an `hsl()` colour comes out black for the whole graph.
export const typeHues = (types: TypeVocabulary, theme: HueTheme): ReadonlyMap<string, string> =>
  new Map(types.map((type) => [type.key, theme === 'dark' ? type.colourDark : type.colourLight]));

// The same job: what a canvas paints where the map above holds no hue. `entities.type` carries a
// foreign key to `entity_type`, so this is the colour of a fault and never of a state, and it is
// grey so that an element which reaches it never reads as a type or a state of its own.
export const UNDECLARED_HUE = '#6b7280';
