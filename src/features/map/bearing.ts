interface LonLat {
  readonly lon: number;
  readonly lat: number;
}

// The y of the Web Mercator plane, in degrees, so the two axes of the angle share one unit.
const mercatorY = (lat: number): number =>
  (Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * 180) / Math.PI;

/** The angle, clockwise from north, of the straight line that the Mercator map draws from `from` to `to`. */
export const planeBearing = (from: LonLat, to: LonLat): number =>
  (Math.atan2(to.lon - from.lon, mercatorY(to.lat) - mercatorY(from.lat)) * 180) / Math.PI;
