/**
 * PROTOTYPE — throwaway. Three ways to draw the **direction** of a relation, on the graph and on
 * the map.
 *
 * It answers **#88 GRAPH-RELATION-DRAW row A5**, in the operator words: "a direction through the
 * shape, or more if it can be done". The data has always carried the direction and neither canvas
 * has drawn it. Which shape says it is a question of taste that no reading of the code settles,
 * so the three stand side by side and the operator chooses one.
 *
 * **Row A6 of the same ticket is already built** — `45b676e`, the hover name — so this file
 * touches no label. It draws the line and nothing else.
 *
 * **The caution of #94 holds.** Sigma and MapLibre are different libraries, so what is shared is
 * the rule and the values below, and never a draw call. Each canvas reads this file and paints
 * with its own machinery.
 *
 * **Open `/graph?variant=B` or `/map?variant=C`.** A bar at the bottom cycles the three, and the
 * arrow keys do the same. The variant is in the address, so a choice can be sent to somebody else.
 *
 * The winner is written again properly on `review/surfaces-2026-08-12`. This branch keeps the
 * losers, as the record of the choice.
 */

export const DIRECTION_VARIANTS = ['A', 'B', 'C'] as const;

export type DirectionVariant = (typeof DIRECTION_VARIANTS)[number];

/** A value from the address is an edge, and it is guarded before its first use. */
export const isDirectionVariant = (value: unknown): value is DirectionVariant =>
  typeof value === 'string' && (DIRECTION_VARIANTS as readonly string[]).includes(value);

/** The variant the address asked for, or `A` where it asked for nothing this file knows. */
export const directionOf = (value: unknown): DirectionVariant =>
  isDirectionVariant(value) ? value : 'A';

/**
 * What one variant is called, and what it says on the screen. The switcher draws both, so the
 * operator reads the intent beside the picture and never has to hold three names in the head.
 */
export interface DirectionVocabulary {
  readonly name: string;
  readonly says: string;
  /**
   * **What it costs.** The previous prototype found that the two libraries do not answer the same
   * questions, and that the finding changed the choice. So each variant states its cost here.
   */
  readonly cost: string;
}

export const DIRECTIONS: Readonly<Record<DirectionVariant, DirectionVocabulary>> = Object.freeze({
  A: {
    name: 'One head at the end',
    says: 'One arrowhead sits at the target end of the line, and points at the thing that receives.',
    cost: 'Nothing on the graph: Sigma ships this edge program. One arrow image and one point layer on the map.',
  },
  B: {
    name: 'Heads along the line',
    says: 'Small heads repeat along the whole line, so the direction reads at any zoom and on any part of it.',
    cost: 'Nothing on the map: MapLibre repeats a symbol along a line. **The graph has no such edge program**, so this is the expensive one.',
  },
  C: {
    name: 'The line itself tapers',
    says: 'The line is wide and faint where it starts, and it narrows and strengthens into the target. No second element.',
    cost: 'Nothing on the graph: Sigma ships the triangle edge program. The map cannot taper a width, so it fades a gradient instead, which needs line metrics on the source.',
  },
});

/**
 * The edge program of Sigma for one variant.
 *
 * `rectangle` is the plain line the graph draws today. It stands under B, because the repeated
 * head has no program here: **B on the graph is the picture with the direction missing**, and
 * that absence is the cost the operator must see before choosing it.
 */
export const sigmaEdgeType = (variant: DirectionVariant): 'arrow' | 'rectangle' | 'triangle' => {
  if (variant === 'A') return 'arrow';
  if (variant === 'C') return 'triangle';
  return 'rectangle';
};

/** How the map draws the direction. One value, so the adapter branches one time. */
export type MapDirection = 'head-at-end' | 'heads-along' | 'taper';

export const mapDirection = (variant: DirectionVariant): MapDirection => {
  if (variant === 'A') return 'head-at-end';
  if (variant === 'B') return 'heads-along';
  return 'taper';
};

/**
 * The size of an arrowhead on the map, in pixels of the source image.
 *
 * It is a fixed number and not a fraction of the line width, for the reason `4bbab56` gives for
 * the pending badge: a value that follows the thing it marks grows where the mark is least
 * wanted.
 */
export const ARROW_PIXELS = 24;

/** How far apart the repeated heads of variant B stand, in screen pixels. */
export const ARROW_SPACING = 70;

/**
 * An arrowhead as an RGBA image, for `map.addImage`.
 *
 * **It is not an SDF.** A relation takes one hue and no other — `adapter.ts` records why — so
 * nothing recolours this image at run time, and an SDF would buy a capability that no layer uses.
 *
 * `pointing` says which way the drawn head faces. MapLibre rotates a point symbol from north with
 * `icon-rotate`, and it rotates a line symbol along the line, so the two placements need two
 * images and never one with a correction angle.
 */
export const arrowImage = (colour: string, pointing: 'up' | 'right'): ImageData => {
  const size = ARROW_PIXELS;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const pen = canvas.getContext('2d');
  if (pen === null) throw new Error('The prototype could not take a 2D context for the arrowhead.');

  pen.fillStyle = colour;
  pen.beginPath();
  if (pointing === 'up') {
    pen.moveTo(size / 2, 0);
    pen.lineTo(size, size);
    pen.lineTo(size / 2, size * 0.72);
    pen.lineTo(0, size);
  } else {
    pen.moveTo(size, size / 2);
    pen.lineTo(0, size);
    pen.lineTo(size * 0.28, size / 2);
    pen.lineTo(0, 0);
  }
  pen.closePath();
  pen.fill();

  return pen.getImageData(0, 0, size, size);
};

/**
 * The bearing from one point to another, in degrees clockwise from north.
 *
 * It is the plane angle and not the great circle one. A relation is drawn as a straight
 * `LineString` between two points, so the angle that matches what is drawn is the angle of that
 * straight line, and a great-circle bearing would point the head off the line at high latitude.
 */
export const bearingOf = (from: readonly [number, number], to: readonly [number, number]): number =>
  (Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI;
