// One list for both canvases, because a feature never imports a feature. The index runs over
// every type of the corpus, never over a drawn subset: a subset gives one type two hues.

/** The light theme is on `:root`, the dark theme on `.dark`. */
export type HueTheme = 'light' | 'dark';

/** The six hues of one theme, in order. */
export type EntityHueSet = readonly [string, string, string, string, string, string];

// Sigma parses hex and `rgb()` on the CPU: an `hsl()` colour comes out black for the whole
// graph in silence, and a CSS custom property reaches neither parser. So the hues are hex.
// Dark set 7.9:1 to 8.9:1 dark and 2.0:1 to 2.3:1 light. Light set 4.6:1 to 5.0:1 light.
const LIGHT_SET = ['#2971c6', '#007989', '#007d50', '#677000', '#a16100', '#b53c7f'] as const;
const DARK_SET = ['#70adfb', '#00c2d2', '#53c48e', '#a8b44b', '#df9b44', '#e887b6'] as const;

// `Object.freeze` locks at run time what `readonly` only promises to the compiler. Both
// canvases share this one object, so an importer that writes into it repaints both, in silence.
export const ENTITY_HUES: Readonly<Record<HueTheme, EntityHueSet>> = Object.freeze({
  light: Object.freeze(LIGHT_SET),
  dark: Object.freeze(DARK_SET),
});

// The sort is what makes the two canvases agree: a type keeps its hue while the set of types
// does not change, whichever surface asks. The caller passes the whole corpus, never a subset.
export const typeHues = (
  types: readonly string[],
  set: EntityHueSet,
): ReadonlyMap<string, string> => {
  const ordered = [...new Set(types)].sort((a, b) => a.localeCompare(b));
  return new Map(ordered.map((type, index) => [type, set[index % set.length] ?? set[0]]));
};
