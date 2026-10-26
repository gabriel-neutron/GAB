// The glyph of a type is the shape of `EntityGlyph`: a path in a box centred on 0,0. A type with no
// entry stays a disc. Filled is promoted evidence; the map draws no candidate.
const GLYPH: Readonly<Record<string, string>> = {
  vessel: 'M0,-6 L6,5 L-6,5Z',
  port: 'M-5.5,-5.5 H-2 V-2.5 H2 V-5.5 H5.5 V5.5 H-5.5Z',
  facility: 'M-5,-5 H5 V5 H-5Z',
  company: 'M5.5,0 A5.5,5.5 0 1 1 -5.5,0 A5.5,5.5 0 1 1 5.5,0Z',
  bank: 'M0,-6.5 L6.5,-2.5 H-6.5Z M-5.5,-1 H5.5 V5.5 H-5.5Z',
  person: 'M0,-6 L5.2,-3 L5.2,3 L0,6 L-5.2,3 L-5.2,-3Z',
  state_body: 'M0,-6 L5.7,-1.9 L3.5,4.9 L-3.5,4.9 L-5.7,-1.9Z',
  legal_act: 'M-4.5,-6 H2 L4.5,-3.5 V6 H-4.5Z',
  military_unit: 'M0,-6.5 L6.5,0 L0,6.5 L-6.5,0Z',
  event: 'M0,-6.5 L1.8,-1.8 L6.5,0 L1.8,1.8 L0,6.5 L-1.8,1.8 L-6.5,0 L-1.8,-1.8Z',
  unknown: 'M5,0 A5,5 0 1 1 -5,0 A5,5 0 1 1 5,0Z',
};

export const hasGlyph = (type: string): boolean => type in GLYPH;

export const glyphImageId = (type: string): string => `type-glyph:${type}`;

// Four pixels to one unit of an 18-unit box: the 2px halo stands outside a 7-unit glyph.
const SCALE = 4;
const BOX = 18;
const MIDDLE = BOX / 2;
const HALO = 4;
const EDGE = 1.5;
const RING = 8;

/** One glyph with a halo of 2px under it, as the raster the map registers. An event adds one thin
 * ring of its own colour, and an unknown type is hollow with a dashed edge. */
export const glyphImage = (type: string, colour: string, halo: string): ImageData => {
  const canvas = document.createElement('canvas');
  canvas.width = BOX * SCALE;
  canvas.height = BOX * SCALE;
  const pen = canvas.getContext('2d');
  if (pen === null) throw new Error('The canvas gave no 2D context for the type glyph.');
  pen.scale(SCALE, SCALE);
  pen.translate(MIDDLE, MIDDLE);
  pen.lineJoin = 'round';
  const path = new Path2D(GLYPH[type] ?? GLYPH['unknown']);
  pen.lineWidth = HALO;
  pen.strokeStyle = halo;
  pen.stroke(path);
  if (type === 'unknown') {
    pen.fillStyle = halo;
    pen.fill(path);
    pen.setLineDash([2, 2]);
    pen.lineWidth = EDGE;
    pen.strokeStyle = colour;
    pen.stroke(path);
    return pen.getImageData(0, 0, canvas.width, canvas.height);
  }
  pen.fillStyle = colour;
  pen.fill(path);
  if (type === 'event') {
    pen.lineWidth = 1;
    pen.strokeStyle = colour;
    pen.beginPath();
    pen.arc(0, 0, RING, 0, 2 * Math.PI);
    pen.stroke();
  }
  return pen.getImageData(0, 0, canvas.width, canvas.height);
};

export const glyphPath = (type: string): string => GLYPH[type] ?? GLYPH['unknown'] ?? '';
