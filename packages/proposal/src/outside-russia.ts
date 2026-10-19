import { z } from 'zod';

import type { Position } from './geometry-positions.ts';

// The outlines of the basemap have no names, so the outline of Russia is the outline that holds
// Moscow (37.62 E, 55.75 N).
const MOSCOW: Position = [37.62, 55.75];

const ring = z.array(z.tuple([z.number(), z.number()]).rest(z.number()));
const polygon = z.array(ring);
const outlines = z.object({
  features: z.array(
    z.object({
      geometry: z.discriminatedUnion('type', [
        z.object({ type: z.literal('Polygon'), coordinates: polygon }),
        z.object({ type: z.literal('MultiPolygon'), coordinates: z.array(polygon) }),
      ]),
    }),
  ),
});

type Ring = z.infer<typeof ring>;

/** Ray casting: a ray from the position to the east crosses the ring an odd number of times. */
const inRing = ([x, y]: Position, points: Ring): boolean => {
  let inside = false;
  points.forEach(([xi, yi], index) => {
    const [xj, yj] = points[index === 0 ? points.length - 1 : index - 1] ?? [xi, yi];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  });
  return inside;
};

const inPolygon = (position: Position, rings: readonly Ring[]): boolean => {
  const [outer, ...holes] = rings;
  return (
    outer !== undefined && inRing(position, outer) && !holes.some((hole) => inRing(position, hole))
  );
};

/** From the text of the country outlines of the basemap: a test that tells if a position is
 * outside Russia. A position is outside Russia when it is in the outline of another country. A
 * position at sea, in no outline, is not outside Russia: an offshore field or a berth off the
 * coast stays a Russian asset. */
export const outsideRussia = (countries: string): ((position: Position) => boolean) => {
  const countryPolygons = outlines
    .parse(JSON.parse(countries))
    .features.map(({ geometry }) =>
      geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates,
    );
  const inCountry = (position: Position, country: readonly Ring[][]): boolean =>
    country.some((one) => inPolygon(position, one));
  const others = countryPolygons.filter((country) => !inCountry(MOSCOW, country));
  return (position) => others.some((country) => inCountry(position, country));
};
