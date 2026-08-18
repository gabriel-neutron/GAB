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
 * **It never wraps and it truncates**, rule 16. A name of two hundred characters would otherwise
 * cover the picture it is naming.
 *
 * `top-0 left-0` with a transform is the same placement rule the ring and the markers of the graph
 * use: one paint per frame, and no layout of the box model in the loop.
 */
export const CANVAS_LABEL_CLASS = [
  'pointer-events-none absolute top-0 left-0 z-10 max-w-64 truncate',
  'border border-border bg-popover px-1.5 py-0.5',
  'font-sans text-xs text-popover-foreground',
].join(' ');

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
