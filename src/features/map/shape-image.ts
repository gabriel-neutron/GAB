/** The mark of a type, and of a kind inside a type, so the points differ by shape and not by hue
 * alone. A type or a kind with no entry here stays a disc: the many oil and gas fields, the
 * quietest mark, are the disc of the facility hue. */
export type Shape = 'square' | 'triangle' | 'hexagon' | 'pentagon' | 'cross';

const SHAPE_OF_TYPE: Readonly<Record<string, Shape>> = { port: 'triangle', company: 'hexagon' };

// The kind of a facility is its `asset_kind` attribute.
const SHAPE_OF_KIND: Readonly<Record<string, Readonly<Record<string, Shape>>>> = {
  facility: { refinery: 'square', lng_plant: 'pentagon', export_terminal: 'cross' },
};

export const shapeOf = (type: string, kind: string | null): Shape | null =>
  (kind === null ? undefined : SHAPE_OF_KIND[type]?.[kind]) ?? SHAPE_OF_TYPE[type] ?? null;

export const shapeImageId = (type: string, shape: Shape): string => `type-shape:${type}:${shape}`;

// Four pixels to one unit of a 14-unit box, so the raster is as wide as a unit symbol and the
// symbol layer scales both with the same ramp.
const SCALE = 4;
const BOX = 14;
const MIDDLE = BOX / 2;
const RADIUS = 5.5;
const STROKE = 1.2;
const EDGE_STROKE = 3;

const regular = (sides: number, turn: number): number[][] =>
  Array.from({ length: sides }, (_, index) => {
    const angle = turn + (index * 2 * Math.PI) / sides;
    return [RADIUS * Math.cos(angle), RADIUS * Math.sin(angle)];
  });

const CORNERS: Readonly<Record<Shape, number[][]>> = {
  square: regular(4, Math.PI / 4),
  triangle: regular(3, -Math.PI / 2),
  hexagon: regular(6, 0),
  pentagon: regular(5, -Math.PI / 2),
  cross: [
    [-1.8, -5.5],
    [1.8, -5.5],
    [1.8, -1.8],
    [5.5, -1.8],
    [5.5, 1.8],
    [1.8, 1.8],
    [1.8, 5.5],
    [-1.8, 5.5],
    [-1.8, 1.8],
    [-5.5, 1.8],
    [-5.5, -1.8],
    [-1.8, -1.8],
  ],
};

const outline = (shape: Shape): Path2D => {
  const path = new Path2D();
  CORNERS[shape].forEach(([x = 0, y = 0], index) => {
    if (index === 0) path.moveTo(MIDDLE + x, MIDDLE + y);
    else path.lineTo(MIDDLE + x, MIDDLE + y);
  });
  path.closePath();
  return path;
};

/** One filled shape with an edge under it, as the raster the map registers. */
export const shapeImage = (shape: Shape, colour: string, edge: string): ImageData => {
  const canvas = document.createElement('canvas');
  canvas.width = BOX * SCALE;
  canvas.height = BOX * SCALE;
  const pen = canvas.getContext('2d');
  if (pen === null) throw new Error('The canvas gave no 2D context for the type shape.');
  pen.scale(SCALE, SCALE);
  pen.lineJoin = 'round';
  const path = outline(shape);
  pen.lineWidth = EDGE_STROKE;
  pen.strokeStyle = edge;
  pen.stroke(path);
  pen.fillStyle = colour;
  pen.fill(path);
  pen.lineWidth = STROKE;
  pen.strokeStyle = edge;
  pen.stroke(path);
  return pen.getImageData(0, 0, canvas.width, canvas.height);
};
