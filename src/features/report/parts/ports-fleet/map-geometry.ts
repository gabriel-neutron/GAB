import land from '../../basemap-data';

// An equirectangular projection true at 55 N, the middle latitude of the export terminals.
const STRETCH = Math.cos((55 * Math.PI) / 180);
const UNIT = 10;

const project = (lon: number, lat: number): readonly [number, number] => [
  lon * STRETCH * UNIT,
  -lat * UNIT,
];

const pathOf = (ring: readonly (readonly number[])[]): string =>
  ring
    .map(([lon = 0, lat = 0], index) => {
      const [x, y] = project(lon, lat);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join('');

const [west = -180, south = -90, east = 180, north = 90] = land.bbox;

const graticule: string[] = [];
// The graticule runs past the basemap, so no line of it draws the edge of the basemap.
for (let lon = -180; lon <= 180; lon += 10)
  graticule.push(
    pathOf([
      [lon, -10],
      [lon, 89],
    ]),
  );
for (let lat = 0; lat <= 80; lat += 10)
  graticule.push(
    pathOf([
      [-180, lat],
      [180, lat],
    ]),
  );

/** A box of the map in degrees: west, south, east, north. */
export type Box = readonly [number, number, number, number];

/** The free part of the view, in CSS pixels, where the box must fit. */
export interface Frame {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
}

/** The projection, the land and the camera of the export map: one job, the geometry of the map. */
export const mapGeometry = {
  project,
  land: land.polygons.map(pathOf).join(''),
  graticule: graticule.join(''),
  source: land.source,
  /** The box of the basemap data in degrees: west, south, east, north. */
  bounds: [west, south, east, north] as Box,
  /** The scale and the shift that put a box in the middle of the free part of the frame. */
  fit: (box: Box, frame: Frame) => {
    const [x0, y0] = project(box[0], box[3]);
    const [x1, y1] = project(box[2], box[1]);
    const freeW = Math.max(1, frame.width - frame.left - frame.right);
    const freeH = Math.max(1, frame.height - frame.top - frame.bottom);
    const scale = Math.min(freeW / (x1 - x0), freeH / (y1 - y0));
    return {
      scale,
      x: frame.left + (freeW - (x1 - x0) * scale) / 2 - x0 * scale,
      y: frame.top + (freeH - (y1 - y0) * scale) / 2 - y0 * scale,
    };
  },
};
