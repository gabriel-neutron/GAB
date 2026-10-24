import type { NatoSymbol } from './nato-symbol';

/** The name of one variant, beside the raster that answers it: two units that recorded the same
 * words draw the same marks, so the map holds one raster per drawing and never one per unit. A
 * name given here and a picture drawn elsewhere would ask MapLibre for an image nobody drew. */
export const unitSymbolImageId = (type: string, symbol: NatoSymbol): string =>
  `unit-symbol:${type}:${symbol.name}`;

// The raster is drawn at four pixels to one unit of the symbol box, so the diamond is 52px wide
// in it. The layer then scales it down, exactly as the arrowhead is scaled down.
const SCALE = 4;

// The centre of the diamond inside the box `nato-symbol.ts` draws in. The point of the unit
// stands here, and not at the centre of that box: the band above the frame holds the echelon.
const CENTRE_ACROSS = 12;
const CENTRE_DOWN = 13;

// The raster is built around that centre, so the icon needs no offset to sit on its point. Half
// the width is the 12 units to the edge of the box and half the height is the 13 units to the
// top of it, and each one carries 1.5 units more, which is the half of the widest stroke below.
const HALF_ACROSS = 13.5;
const HALF_DOWN = 14.5;

// The stroke of the marks, as the inline drawing of the side rail states it: heavy enough that a
// row of dots reads as dots. The wider pass under it is the edge that keeps the symbol clear of
// the imagery, and it leaves 0.9 units of edge on each side of a mark.
const STROKE = 1.2;
const EDGE_STROKE = 3;

/** The marks of one unit, as a raster the map registers. The edge is drawn under the marks, so
 * the symbol stays readable on every ground, and the caller states both hues. */
export const unitSymbolImage = (symbol: NatoSymbol, colour: string, edge: string): ImageData => {
  const canvas = document.createElement('canvas');
  canvas.width = HALF_ACROSS * 2 * SCALE;
  canvas.height = HALF_DOWN * 2 * SCALE;
  const pen = canvas.getContext('2d');
  // A context is refused when the document has no renderer left, which is a closed view and not a
  // fault to report. The caller is a style resolver, so it must answer something.
  if (pen === null) throw new Error('The canvas gave no 2D context for the unit symbol.');

  pen.scale(SCALE, SCALE);
  pen.translate(HALF_ACROSS - CENTRE_ACROSS, HALF_DOWN - CENTRE_DOWN);
  pen.lineCap = 'round';
  pen.lineJoin = 'round';

  const marks = [new Path2D(symbol.frame)];
  if (symbol.echelon !== null) marks.push(new Path2D(symbol.echelon));
  if (symbol.domain !== null) marks.push(new Path2D(symbol.domain));

  for (const pass of [
    { width: EDGE_STROKE, hue: edge },
    { width: STROKE, hue: colour },
  ]) {
    pen.lineWidth = pass.width;
    pen.strokeStyle = pass.hue;
    for (const mark of marks) pen.stroke(mark);
  }

  return pen.getImageData(0, 0, canvas.width, canvas.height);
};
