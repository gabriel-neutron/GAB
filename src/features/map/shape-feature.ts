import type { Area, Ring } from '@/shared/read/model';

import type { GeoEntity } from './projection';

// `id` is the `fid` of the projection, as on a point, so a click on the area finds its entity.
export interface ShapeFeature {
  readonly type: 'Feature';
  readonly id: number;
  readonly geometry:
    | { readonly type: 'Polygon'; readonly coordinates: readonly Ring[] }
    | { readonly type: 'MultiPolygon'; readonly coordinates: Area }
    | { readonly type: 'MultiLineString'; readonly coordinates: readonly Ring[] };
  readonly properties: {
    readonly entityType: string;
    /** The hue of the stage of the asset, which the Chain mode draws. Absent with no stage. */
    readonly stageColour?: string;
  };
}

/** The feature that draws the shape of an entity, or null for an entity that a point locates or
 * whose type has no hue. The stage hue goes with the shape, so the Chain mode draws a route or an
 * area in the colour of the point of the same asset. The outline layer of the type draws a route as it draws the edge of an
 * area, and the fill layer draws nothing for a route. */
export function shapeFeatureOf(
  entity: GeoEntity,
  hasHue: boolean,
  stageColour?: string,
): ShapeFeature | null {
  if (!hasHue) return null;
  const { area, route } = entity;
  const properties = {
    entityType: entity.type,
    ...(stageColour === undefined ? {} : { stageColour }),
  };
  if (route !== null)
    return {
      type: 'Feature',
      id: entity.fid,
      geometry: { type: 'MultiLineString', coordinates: route },
      properties,
    };
  if (area === null) return null;
  const [only] = area;
  return {
    type: 'Feature',
    id: entity.fid,
    geometry:
      area.length === 1 && only !== undefined
        ? { type: 'Polygon', coordinates: only }
        : { type: 'MultiPolygon', coordinates: area },
    properties,
  };
}
