/**
 * The name that a pointer draws over a canvas, in one recipe for both canvases.
 *
 * **The operator asked for one visual vocabulary across the graph and the map** — #81 row A10 and
 * #91. They liked the hover name of the graph and asked for it on the map, so that the two
 * surfaces read as one product.
 *
 * **The two canvases are drawn by different libraries**, Sigma and MapLibre, so no draw call is
 * shared and no React component can own this element: `CANVAS.md` gives the DOM over a live canvas
 * to the adapter of that canvas. What is shared is this file — the words of the class list and the
 * one geometry rule — and each adapter builds its element from it. One place states how the label
 * looks, and the two can never drift apart.
 *
 * **It replaces the hover card of Sigma, and that is a fix and not only a move.**
 * `features/graph/controller.ts` already recorded the defect: the label colour of the library is
 * one fixed value that no token of this repository reaches, so the card drew black text on a white
 * box over a dark canvas. `defaultDrawNodeHover` switches it off, and this draws in the tokens of
 * the theme.
 */

/**
 * The label itself.
 *
 * **It takes no pointer event.** It sits over the canvas and follows the pointer, so a label that
 * took the pointer would put itself between the analyst and the thing it names, and the leave
 * event would never arrive.
 *
 * **Each line truncates and none of them wraps**, rule 16. A name of two hundred characters would
 * otherwise cover the picture it is naming. A relation takes three lines, so the box is a column
 * and each line truncates on its own.
 *
 * `top-0 left-0` with a transform is the same placement rule the ring and the markers of the graph
 * use: one paint per frame, and no layout of the box model in the loop.
 */
export const CANVAS_LABEL_CLASS = [
  'pointer-events-none absolute top-0 left-0 z-10 flex max-w-64 flex-col',
  'border border-border bg-popover px-1.5 py-0.5',
  'font-sans text-xs text-popover-foreground',
  '[&>*]:truncate',
].join(' ');

/**
 * What a relation says, in three lines.
 *
 * **One line was unreadable, and the operator said so.** `A — type — B` put three names in a row
 * and truncated the lot at the width of the box. A relation is a statement about two entities, so
 * it is drawn as one: an entity, what it does, and the other entity.
 *
 * **The arrow is the direction, and it runs from the first line to the third.** The data has
 * carried a direction all along and neither canvas drew it. **#88 GRAPH-RELATION-DRAW still owns
 * the direction on the line itself**, which is a different job: this names a relation, and #88
 * draws one.
 *
 * **A third caller reads it, and it is not a canvas** — #89. The detail view of a relation states
 * the same relation in a panel, so it takes these words and it writes no second wording for the
 * direction. The file is named for the two canvases that asked for it first; what it holds is one
 * vocabulary for a relation and for an entity, and any surface of this product may read it.
 *
 * **The three lines are a tuple, and not a list of unknown length.** A caller that draws one line
 * at a time — a panel does, and a canvas does not — would otherwise test each line for `undefined`
 * and invent words for a case that cannot occur.
 */
export const relationLines = (
  from: string,
  type: string,
  to: string,
): readonly [string, string, string] => [from, `↓ ${relationTypeWords(type)}`, to];

/**
 * The type of a relation, in words: `berthed_at` reads as `berthed at`.
 *
 * **One rule, for the two canvases and for the detail surface** — the operator ruled it on #89.
 * The panel read a type in words and the hover over the same line read the identifier, so one
 * relation had two names on two screens. The detail surface has humanised a key since it was
 * built, `relationLines` above humanises for both canvases, and this is the one function that
 * does it. **The raw identifier now appears on no screen**, which is the cost of the rule.
 */
export const relationTypeWords = (type: string): string => type.replaceAll('_', ' ');

/**
 * What an entity says, in two lines.
 *
 * **The count is the words that the size owes a reader** — #87. The graph sizes a node by its
 * degree, and a size alone is unreadable to anybody who cannot compare two discs: the ticket
 * asked for words beside the hue, and the same argument reaches the radius. The map draws every
 * point at one radius, so the count states there what the picture never draws at all.
 *
 * **One sentence and not a bare figure.** A number alone under a name reads as an identifier or a
 * year. The word says which quantity it is.
 */
export const entityLines = (label: string, relations: number): readonly string[] => [
  label,
  relations === 1 ? '1 relation' : `${relations} relations`,
];

/**
 * How far above the point the label sits, in pixels.
 *
 * The label is placed by its bottom centre, so it stands clear of the dot it names and of the
 * pointer. A label centred on the point would cover the very thing the analyst is pointing at.
 */
export const CANVAS_LABEL_OFFSET = 12;

/**
 * Where the label goes for a point on the canvas, as a CSS transform.
 *
 * One rule for both surfaces: bottom centre, one offset above the point. A surface that wrote its
 * own transform would drift from the other the first time either was tuned.
 */
export const canvasLabelTransform = (x: number, y: number): string =>
  `translate(${x}px, ${y - CANVAS_LABEL_OFFSET}px) translate(-50%, -100%)`;
