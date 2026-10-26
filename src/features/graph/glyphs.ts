// The shape of each entity type, from `design/system/components/EntityGlyph`. Each shape is
// drawn in a 14 by 14 box centred on 0,0. The canvas program and the legend read this one table.

export interface Glyph {
  /** Closed polygons in the box. Their union is the shape. Empty for a circle. */
  readonly polygons: readonly (readonly (readonly [number, number])[])[];
  /** The radius of a circle, or 0 for a polygon shape. */
  readonly circle: number;
  /** A dashed outline in place of a fill: the unknown type. */
  readonly dashed: boolean;
}

const poly = (...points: [number, number][]): readonly (readonly [number, number])[] => points;

const UNKNOWN: Glyph = { polygons: [], circle: 5, dashed: true };

export const GLYPHS: Readonly<Record<string, Glyph>> = {
  vessel: { polygons: [poly([0, -6], [6, 5], [-6, 5])], circle: 0, dashed: false },
  port: {
    polygons: [
      poly(
        [-5.5, -5.5],
        [-2, -5.5],
        [-2, -2.5],
        [2, -2.5],
        [2, -5.5],
        [5.5, -5.5],
        [5.5, 5.5],
        [-5.5, 5.5],
      ),
    ],
    circle: 0,
    dashed: false,
  },
  facility: { polygons: [poly([-5, -5], [5, -5], [5, 5], [-5, 5])], circle: 0, dashed: false },
  company: { polygons: [], circle: 5.5, dashed: false },
  bank: {
    polygons: [
      poly([0, -6.5], [6.5, -2.5], [-6.5, -2.5]),
      poly([-5.5, -1], [5.5, -1], [5.5, 5.5], [-5.5, 5.5]),
    ],
    circle: 0,
    dashed: false,
  },
  person: {
    polygons: [poly([0, -6], [5.2, -3], [5.2, 3], [0, 6], [-5.2, 3], [-5.2, -3])],
    circle: 0,
    dashed: false,
  },
  state_body: {
    polygons: [poly([0, -6], [5.7, -1.9], [3.5, 4.9], [-3.5, 4.9], [-5.7, -1.9])],
    circle: 0,
    dashed: false,
  },
  legal_act: {
    polygons: [poly([-4.5, -6], [2, -6], [4.5, -3.5], [4.5, 6], [-4.5, 6])],
    circle: 0,
    dashed: false,
  },
  military_unit: {
    polygons: [poly([0, -6.5], [6.5, 0], [0, 6.5], [-6.5, 0])],
    circle: 0,
    dashed: false,
  },
  event: {
    polygons: [
      poly(
        [0, -6.5],
        [1.8, -1.8],
        [6.5, 0],
        [1.8, 1.8],
        [0, 6.5],
        [-1.8, 1.8],
        [-6.5, 0],
        [-1.8, -1.8],
      ),
    ],
    circle: 0,
    dashed: false,
  },
  unknown: UNKNOWN,
};

/** A type the table does not hold draws as the unknown glyph, the one that states "no type". */
export const glyphOf = (type: string): Glyph => GLYPHS[type] ?? UNKNOWN;

/** The SVG path data of a polygon glyph, for the legend. A circle has none. */
export const pathOf = (glyph: Glyph): string =>
  glyph.polygons
    .map((points) => `M${points.map(([x, y]) => `${String(x)},${String(y)}`).join(' L')}Z`)
    .join(' ');
