// One reader for both canvases, because a feature never imports a feature.

import type { TypeVocabulary } from './read/model';

/** The light theme is on `:root`, the dark theme on `.dark`. */
export type HueTheme = 'light' | 'dark';

// A hue is a declared property of a type and never a position in a list. The declaration is what
// makes the two canvases agree, and what a new type does not disturb. The column holds hex:
// Sigma parses hex on the CPU, and an `hsl()` colour comes out black for the whole graph.
export const typeHues = (types: TypeVocabulary, theme: HueTheme): ReadonlyMap<string, string> =>
  new Map(types.map((type) => [type.key, theme === 'dark' ? type.colourDark : type.colourLight]));

// The same job: what a canvas paints where the map above holds no hue. NOT A GREY — the seed
// gives `unknown` a grey and that is a state, so a fault in the same grey would read as that
// state. These are the two hues of `--dissent`, copied as hex, at 6.7:1 on their own ground.
export const UNDECLARED_HUE: Readonly<Record<HueTheme, string>> = Object.freeze({
  light: '#ac1b18',
  dark: '#f66e60',
});
