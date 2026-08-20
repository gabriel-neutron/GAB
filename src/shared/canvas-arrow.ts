/**
 * The head that says which way a relation points, in one shape for both canvases.
 *
 * **The data has always carried a direction and neither canvas drew one.** The operator asked
 * for "a direction through the shape". The hover name of `./canvas-label` says the direction in
 * words. This says it on the line.
 *
 * **One head, at the end the relation arrives at.** Three forms were built and shown on
 * `proto/direction-2026-08-18`, and the operator chose this one. The two that lost are on the tag
 * of that name, with what each one cost:
 *
 * - Heads repeated along the line. **Sigma ships no edge program that repeats a mark**, so the
 *   graph would have carried no direction at all while the map carried one.
 * - The line itself tapered. Sigma tapers a true width; **MapLibre cannot taper a width**, so the
 *   map faded a gradient instead. On the light ground the faint half went to nothing, and the
 *   relation then stated one end and not two.
 *
 * **The two canvases are drawn by different libraries**, so no draw call is shared. What is
 * shared is the silhouette below: Sigma builds the head from two
 * ratios of the line thickness, and MapLibre takes a raster image, so the one shape is given to
 * each library in the form that library takes. One place states the shape, and the two cannot
 * drift.
 */

/**
 * The head is a plain triangle, and these two numbers are the whole of its shape.
 *
 * **They are ratios of the thickness of the line, because that is what Sigma takes.** The map
 * reads them too, so the image it draws has the same silhouette as the head the graph draws.
 *
 * **The numbers are small, and the reason is the hit box.** A relation takes a pick band of 10px
 * — about 5px on each side, and any new shape must keep it — so the line of the graph is drawn
 * 10px wide. At the ratios of the library the head came out about 25px
 * on a dot of about 10px, and a mark bigger than the thing it points at is the fault that
 * `4bbab56` corrected for the pending badge. These two were read in a browser, and not calculated.
 */
export const ARROW_LENGTH_RATIO = 1.2;
export const ARROW_WIDTH_RATIO = 1.1;

/** The side of the arrow image, in pixels of its own raster. */
const ARROW_PIXELS = 24;

/**
 * The head as a raster image, for a library that takes one.
 *
 * **It is not an SDF.** A relation takes one hue and no other — `features/map/adapter.ts` records
 * why — so no layer recolours this image, and an SDF would buy a capability that nothing uses.
 *
 * **It points north**, because the caller rotates it by a bearing and a bearing is measured from
 * north. A head drawn at any other angle would need a correction that one of the two callers would
 * forget.
 *
 * The triangle is inscribed in the square at the ratio above: `ARROW_WIDTH_RATIO` across the base
 * and `ARROW_LENGTH_RATIO` from the base to the point.
 */
export const arrowImage = (colour: string): ImageData => {
  const canvas = document.createElement('canvas');
  canvas.width = ARROW_PIXELS;
  canvas.height = ARROW_PIXELS;
  const pen = canvas.getContext('2d');
  // A context is refused when the document has no renderer left, which is a closed view and not a
  // fault to report. The caller is a style resolver, so it must answer something.
  if (pen === null) throw new Error('The canvas gave no 2D context for the arrowhead.');

  const scale = ARROW_PIXELS / Math.max(ARROW_LENGTH_RATIO, ARROW_WIDTH_RATIO);
  const half = (ARROW_WIDTH_RATIO * scale) / 2;
  const length = ARROW_LENGTH_RATIO * scale;
  const middle = ARROW_PIXELS / 2;

  pen.fillStyle = colour;
  pen.beginPath();
  pen.moveTo(middle, 0);
  pen.lineTo(middle + half, length);
  pen.lineTo(middle - half, length);
  pen.closePath();
  pen.fill();

  return pen.getImageData(0, 0, ARROW_PIXELS, ARROW_PIXELS);
};
