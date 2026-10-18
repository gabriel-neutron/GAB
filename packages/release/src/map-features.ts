import { z } from 'zod';

const collection = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      geometry: z.object({ type: z.string() }),
      properties: z.object({ label: z.string(), type: z.string() }),
    }),
  ),
});

/** One entity that the map draws. */
export interface MapFeature {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly geometry: string;
}

/** The entities of the GeoJSON file of a release, in the order of the file. */
export const mapFeatures = (geojson: string): readonly MapFeature[] =>
  collection.parse(JSON.parse(geojson)).features.map((one) => ({
    id: one.id,
    label: one.properties.label,
    type: one.properties.type,
    geometry: one.geometry.type,
  }));
