/**
 * PROTOTYPE — throwaway. Three visual vocabularies for a node, a relation, a selection and a
 * pending proposal, so that the operator can choose one by looking at it.
 *
 * **The question:** #91 row A9 — "the idea is right and the form is not" — and the ask of #94 that
 * the graph and the map draw a node and a relation the same way. Both are questions of taste that
 * no reading of the code can settle.
 *
 * **How to use it.** Open `/graph?variant=B` or `/map?variant=C`. A bar at the bottom of the
 * screen cycles the three, and the arrow keys do the same. The variant is in the address, so a
 * choice can be sent to somebody else.
 *
 * **What is deliberately not here.** No test, no fallback, no abstraction. The winner is written
 * again, properly, in the shared file that #94 describes, and this file is deleted with the
 * switcher and the two routes that read the parameter.
 *
 * **What each library can actually draw, measured in a browser and not assumed.**
 *
 * - **MapLibre takes every value as a paint property.** The fill, its opacity, the edge and its
 *   colour, and the two line ramps all answer a variant. The map draws all three in full.
 * - **Sigma paints a node through one WebGL program.** A variant reaches its **size** and its
 *   **colour**, and nothing else: `dot.stroke` and `dot.fillOpacity` do not reach the graph.
 *   **So a hollow dot — variant B — is drawn by the map and not by the graph.** A hollow node on
 *   the graph needs a node program of our own, which is real work and not a tuning value.
 * - The ring and the pending mark are DOM elements over the graph canvas, so this file has a free
 *   hand there: all three pending shapes and all three selection shapes are drawn on both.
 *
 * **What that means for the choice.** A and C can be one vocabulary on both canvases today. B can
 * be one vocabulary only if the graph gains a node program, and the operator should know the cost
 * before choosing it.
 */

/** The key of one variant, as the address carries it. */
export type MarkVariant = 'A' | 'B' | 'C';

export const MARK_VARIANTS: readonly MarkVariant[] = ['A', 'B', 'C'];

export const isMarkVariant = (value: unknown): value is MarkVariant =>
  value === 'A' || value === 'B' || value === 'C';

export interface MarkVocabulary {
  /** What the bar at the bottom of the screen calls it. */
  readonly name: string;
  /** One sentence, so the operator reads what they are looking at. */
  readonly says: string;

  /**
   * The dot.
   *
   * `radius` is the pair the two canvases ramp between — the small end at the far zoom and the
   * large end at the near one. `stroke` is the width of the edge of a dot, in pixels, and 0 draws
   * none. `strokeFromGround` draws that edge in the colour of the page instead of the hue, which
   * is what separates two dots that touch.
   */
  readonly dot: {
    readonly radius: readonly [number, number];
    readonly stroke: number;
    readonly strokeFromGround: boolean;
    /** 1 fills the dot, and a lower number makes it a ring with the ground showing through. */
    readonly fillOpacity: number;
  };

  /** The line of a relation, in the same shape: a ramp, and how much of it you see. */
  readonly line: {
    readonly width: readonly [number, number];
    readonly opacity: number;
    /** The width and the opacity of the lines of the selected element. */
    readonly activeWidth: readonly [number, number];
    readonly activeOpacity: number;
  };

  /**
   * What names the selected element.
   *
   * - `ring` — an outline outside the dot, which is what both canvases draw today.
   * - `halo` — a wide, faint disc behind the dot.
   * - `double` — two thin rings, so the mark reads at a small size.
   */
  readonly selection: 'ring' | 'halo' | 'double';

  /**
   * What marks an element that carries a pending proposal — #91 A9, and #10 owns what it states.
   *
   * - `badge` — a small square at the upper right of the dot, clear of it.
   * - `dashed` — the dot itself takes a broken outline, and no second element is drawn.
   * - `halo` — a soft disc behind the dot, in the candidate colour.
   */
  readonly pending: 'badge' | 'dashed' | 'halo';
}

/**
 * A — **Solid dots, badge at the corner.** The vocabulary of today, with the one thing the
 * operator can already see fixed: the square moves off the centre of the dot, so it stops covering
 * the thing it marks.
 */
const A: MarkVocabulary = {
  name: 'Solid dots, badge at the corner',
  says: 'Filled dots with no edge. A pending proposal is a small square at the upper right, clear of the dot. The selection is one ring outside.',
  dot: { radius: [3, 7], stroke: 0, strokeFromGround: false, fillOpacity: 1 },
  line: { width: [1, 2.2], opacity: 0.55, activeWidth: [1.4, 3.5], activeOpacity: 0.95 },
  selection: 'ring',
  pending: 'badge',
};

/**
 * B — **Rings, and the mark is the dot itself.** Every dot is drawn hollow, so two that overlap
 * both stay readable and the ground shows through on the map. A pending proposal breaks the
 * outline of its own dot, so the canvas gains no second element at all.
 */
const B: MarkVocabulary = {
  name: 'Rings, pending breaks the outline',
  says: 'Hollow dots with a thick edge: two that overlap stay readable, and the ground shows through. A pending proposal breaks the outline of its own dot, and adds nothing beside it. The selection fills the centre.',
  dot: { radius: [4, 9], stroke: 2, strokeFromGround: false, fillOpacity: 0.15 },
  line: { width: [1, 1.8], opacity: 0.45, activeWidth: [1.6, 3], activeOpacity: 1 },
  selection: 'double',
  pending: 'dashed',
};

/**
 * C — **Weighted dots, halo for what waits.** The dot is larger and carries an edge in the colour
 * of the page, which separates a cluster. A pending proposal is a soft halo behind the dot, so it
 * reads at any zoom and covers nothing.
 */
const C: MarkVocabulary = {
  name: 'Weighted dots, halo for what waits',
  says: 'Larger dots with an edge in the colour of the page, so a cluster separates. A pending proposal is a soft halo behind the dot: it covers nothing and it reads at any zoom. The selection is a wide faint disc.',
  dot: { radius: [4, 9], stroke: 1.5, strokeFromGround: true, fillOpacity: 1 },
  line: { width: [0.8, 1.6], opacity: 0.4, activeWidth: [1.6, 3.5], activeOpacity: 1 },
  selection: 'halo',
  pending: 'halo',
};

export const MARKS: Readonly<Record<MarkVariant, MarkVocabulary>> = { A, B, C };

/** The variant the address asks for, or A. */
export const markOf = (value: unknown): MarkVocabulary => MARKS[isMarkVariant(value) ? value : 'A'];

/**
 * The class list of the pending mark over the graph canvas, for one variant.
 *
 * The graph draws this element itself, over the canvas — `CANVAS.md` — so a variant reaches it as
 * words and not as a paint property.
 */
export const pendingClassOf = (mark: MarkVocabulary): string => {
  const base = 'pointer-events-none absolute top-0 left-0';
  if (mark.pending === 'badge') {
    // Clear of the dot, at the upper right, and it carries an edge in the colour of the page so it
    // never merges into the hue under it.
    return `${base} size-2 border border-background bg-candidate`;
  }
  if (mark.pending === 'dashed') {
    return `${base} rounded-full border-2 border-dashed border-candidate`;
  }
  return `${base} rounded-full bg-candidate/35`;
};

/** How far the pending mark of the graph sits from the centre of the dot, in pixels. */
export const pendingOffsetOf = (mark: MarkVocabulary): number => (mark.pending === 'badge' ? 7 : 0);

/** The class list of the selection ring over the graph canvas, for one variant. */
export const selectionClassOf = (mark: MarkVocabulary): string => {
  const base = 'pointer-events-none absolute top-0 left-0 rounded-full';
  if (mark.selection === 'ring') return `${base} border-2 border-foreground`;
  if (mark.selection === 'double') return `${base} border-2 border-foreground/40 bg-foreground/10`;
  return `${base} bg-foreground/15`;
};

/** How much wider than the dot the selection mark is, in pixels of diameter. */
export const selectionMarginOf = (mark: MarkVocabulary): number =>
  mark.selection === 'halo' ? 16 : 6;
