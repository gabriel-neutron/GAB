import type { Area, Point, Ring } from './model';

// The scanlines that are tried, as fractions of the height of the polygon. The widest span found
// is taken, so a thin neck at the middle does not decide the point.
const SCANLINES = [0.5, 0.4, 0.6, 0.3, 0.7, 0.2, 0.8, 0.1, 0.9] as const;

const ringArea = (ring: Ring): number => {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i] ?? [0, 0];
    const [xj, yj] = ring[j] ?? [0, 0];
    sum += xj * yi - xi * yj;
  }
  return Math.abs(sum) / 2;
};

// The longitudes where the line at `lat` crosses an edge, left to right. A half-open test on the
// edge counts a vertex that lies on the line once, so the crossings always pair up.
const crossings = (rings: readonly Ring[], lat: number): readonly number[] => {
  const found: number[] = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
      const [xi, yi] = ring[i] ?? [0, 0];
      const [xj, yj] = ring[j] ?? [0, 0];
      if (yi > lat !== yj > lat) found.push(xi + ((lat - yi) * (xj - xi)) / (yj - yi));
    }
  }
  return found.sort((a, b) => a - b);
};

// A centroid lies outside a crescent or a U, so this takes the middle of the widest span that a
// horizontal line cuts inside the largest polygon. The shape alone decides, so a mark never moves.
export function interiorPointOf(area: Area): Point | null {
  let largest: readonly Ring[] | null = null;
  let largestSize = -1;
  for (const rings of area) {
    const outer = rings[0];
    if (outer === undefined || outer.length === 0) continue;
    const size = ringArea(outer);
    if (size > largestSize) {
      largest = rings;
      largestSize = size;
    }
  }
  const outer = largest?.[0];
  if (largest === null || outer === undefined) return null;

  let south = Infinity;
  let north = -Infinity;
  for (const [, lat] of outer) {
    south = Math.min(south, lat);
    north = Math.max(north, lat);
  }
  const height = north - south;

  let best: Point | null = null;
  let bestSpan = -1;
  for (const fraction of SCANLINES) {
    const lat = south + height * fraction;
    const held = crossings(largest, lat);
    for (let i = 0; i + 1 < held.length; i += 2) {
      const from = held[i] ?? 0;
      const to = held[i + 1] ?? 0;
      if (to - from > bestSpan) {
        bestSpan = to - from;
        best = { lon: (from + to) / 2, lat };
      }
    }
  }
  if (best !== null) return best;

  // A polygon with no width has no inside. Its first vertex is a point of it.
  const [lon, lat] = outer[0] ?? [0, 0];
  return { lon, lat };
}
