// Origin: 192px still holds a name, a count and the eye on one line, and 480px leaves the canvas
// the larger part of a 1280px screen. Both are guesses, to be tuned on a real screen.
export const RAIL_WIDTH = { min: 192, max: 480 } as const;

// Departure: a stored width is clamped where it is drawn, so a width from a larger screen, or
// from an older build with other bounds, still draws a rail that can be read.
export function railWidthWithin(width: number): number {
  if (!Number.isFinite(width)) return RAIL_WIDTH.min;
  return Math.round(Math.min(RAIL_WIDTH.max, Math.max(RAIL_WIDTH.min, width)));
}
