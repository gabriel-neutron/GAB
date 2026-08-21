// Sigma ships no edge program that repeats a mark and MapLibre cannot taper a width, so the one
// shape is a head, given to each library in the form it takes: ratios of the line thickness, or
// a raster. The ratios are small because a relation takes a 10px pick band and the line is 10px.
export const ARROW_LENGTH_RATIO = 1.2;
export const ARROW_WIDTH_RATIO = 1.1;

/** The side of the arrow image, in pixels of its own raster. */
const ARROW_PIXELS = 24;

// Not an SDF: a relation takes one hue, so no layer recolours this image and an SDF would buy a
// capability that nothing uses. It points north because the caller rotates it by a bearing, and
// a bearing is measured from north.
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
