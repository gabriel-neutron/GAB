import type { GraphCamera } from './workspace';

// Origin: invented. The whole picture stands at a ratio of 1, so 0.05 is twenty times nearer.
// That parts the nodes of a dense corpus; a nearer camera shows only empty ground.
export const NEAREST_RATIO = 0.05;

// Origin: invented. At a ratio of 4 the whole picture is a quarter of the canvas.
export const FARTHEST_RATIO = 4;

// Departure: a stored camera outside the bounds is dropped and not clamped. A clamp keeps the
// centre, and that centre can stand on empty ground, so the reader would still see nothing.
export const restorableCamera = (camera: GraphCamera | null): GraphCamera | null =>
  camera !== null && camera.ratio >= NEAREST_RATIO && camera.ratio <= FARTHEST_RATIO
    ? camera
    : null;
