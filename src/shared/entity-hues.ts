/**
 * The hue of an entity type, in one list and one rule for both canvases.
 *
 * **The operator lifted the hues here** — #87. `features/graph/model.ts` had written the
 * condition in advance: "A feature never imports a feature (ADR 0001 §1), so the two copies
 * cannot become one **until the operator lifts the hues into `shared/`**." That day is this one,
 * and the two copies are one list below.
 *
 * **The graph paints by type now, and no longer by community** — #87. A hue was the community of
 * a node, and three facts closed that:
 *
 * - **A hue is a grouping and never an identity.** Six hues cycle, so a seventh group wears the
 *   hue of the first.
 * - **A community number is a rank of size** — `features/graph/structure.ts` renumbers so that
 *   index 0 is the largest. One new entity renumbers the run, and the whole picture repaints.
 *   **A type never renumbers.**
 * - **No word on the screen said what a hue meant.** The legend that said it is gone — #82 B1 to
 *   B7 — and `SKILL.md` forbids a hue as the only mark. The rail names the type beside its hue,
 *   on both surfaces, so the words are there and no legend comes back.
 *
 * **The community run stays, and it places the nodes.** That is its only job now.
 *
 * **The order is over every type of the corpus, and not over the types one surface draws.** The
 * map draws no entity without a geometry and the graph draws none without a position, so the two
 * see different entities. An index taken from a drawn subset would give one type two hues, one
 * per canvas, in silence. The rule below takes the whole corpus, so the two agree by
 * construction.
 *
 * **The hue cycles, and it says so** — #81 row A6. A seventh type wears the hue of the first.
 * **#93 ENTITY-TYPE-TABLE puts a decided colour on the type itself** and ends the cycle. This
 * file assumes no answer: it cycles, and it states it.
 */

/** Which theme the page has. The light theme is on `:root`, the dark theme on `.dark`. */
export type HueTheme = 'light' | 'dark';

/** The six hues of one theme, in order. */
export type EntityHueSet = readonly [string, string, string, string, string, string];

/**
 * The six entity hues of `src/index.css`, converted from `oklch` to hex, in both themes.
 *
 * **A colour must be a colour that the library reads.** Sigma parses hex and `rgb()` on the CPU,
 * and an `hsl()` colour comes out black for the whole graph in silence. MapLibre parses its style
 * with its own parser. `CANVAS.md` states the second half: **a CSS custom property never reaches
 * either parser**, so the hues of the stylesheet are copied here as hex. This file is that copy,
 * and it is now the only one.
 *
 * **Each surface states which set it takes, and why.** `src/index.css` asks 3:1 of a mark a
 * person must see.
 *
 * - **The dark set gives 7.9:1 to 8.9:1 on the dark page and 2.0:1 to 2.3:1 on the light page.**
 * - **The light set gives 4.6:1 to 5.0:1 on the light page.**
 *
 * So a canvas whose ground follows the theme takes the set of that theme, and a canvas whose
 * ground is imagery takes the dark set on both themes. `CANVAS.md` rules the second case: a point
 * sits on imagery, and the light set cannot be read on it.
 */
const LIGHT_SET = ['#2971c6', '#007989', '#007d50', '#677000', '#a16100', '#b53c7f'] as const;
const DARK_SET = ['#70adfb', '#00c2d2', '#53c48e', '#a8b44b', '#df9b44', '#e887b6'] as const;

/**
 * `readonly` is a promise to the compiler, and `Object.freeze` is a lock at run time. This value
 * is one module object that both canvases share, so an importer that writes into it changes the
 * paint of both surfaces in silence. The freeze reaches each list of hues too.
 */
export const ENTITY_HUES: Readonly<Record<HueTheme, EntityHueSet>> = Object.freeze({
  light: Object.freeze(LIGHT_SET),
  dark: Object.freeze(DARK_SET),
});

/**
 * The hue of each type, for one theme.
 *
 * It takes every type of the corpus, in any order and with repeats, and it answers one map. The
 * sort is the rule that makes the answer the same on the two canvases: a type keeps its hue while
 * the set of types does not change, whichever surface asks.
 *
 * **A caller passes the whole corpus and never its own drawn subset.** See the head of this file.
 */
export const typeHues = (
  types: readonly string[],
  set: EntityHueSet,
): ReadonlyMap<string, string> => {
  const ordered = [...new Set(types)].sort((a, b) => a.localeCompare(b));
  return new Map(ordered.map((type, index) => [type, set[index % set.length] ?? set[0]]));
};
