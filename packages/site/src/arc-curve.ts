import type { Position } from './geometry-positions.ts';

// Origin of the numbers: 16 segments make a smooth line at the zoom of the whole country, and a
// bend of one fifth of the length keeps two arcs between the same two places apart from a straight
// pipeline line.
const SEGMENTS = 16;
const BEND = 0.2;

/** The positions of a curved line from one position to another: a quadratic Bezier curve that
 * bends to the left of the direction of the link. */
export const arcCurve = (from: Position, to: Position): Position[] => {
  const [x0, y0] = from;
  const [x2, y2] = to;
  const x1 = (x0 + x2) / 2 - (y2 - y0) * BEND;
  const y1 = (y0 + y2) / 2 + (x2 - x0) * BEND;
  return Array.from({ length: SEGMENTS + 1 }, (_, step) => {
    const t = step / SEGMENTS;
    const a = (1 - t) ** 2;
    const b = 2 * (1 - t) * t;
    const c = t ** 2;
    return [a * x0 + b * x1 + c * x2, a * y0 + b * y1 + c * y2];
  });
};
