import { z } from 'zod';

const measure = z.object({
  measure: z.enum(['designated_by', 'restricted_by']),
  from: z.string().nullable(),
  to: z.string().nullable(),
  act_id: z.string(),
  act_label: z.string(),
  act_document: z.string().nullable(),
  origin_label: z.string(),
});

const status = z.object({
  eu: z.array(measure),
  us: z.array(measure),
  uk: z.array(measure),
});

const collection = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      properties: z.object({ sanctions: status.optional() }),
    }),
  ),
});

/** The measures of one regime against an asset, as the release gives them. */
export type AssetMeasure = z.infer<typeof measure>;

/** The sanctions status of each asset of the GeoJSON file of a release, for each regime, by entity
 * identifier. An entity with no status in the file (an entity that is not a facility) is absent. */
export const assetSanctions = (geojson: string): ReadonlyMap<string, z.infer<typeof status>> => {
  const found = new Map<string, z.infer<typeof status>>();
  for (const one of collection.parse(JSON.parse(geojson)).features)
    if (one.properties.sanctions !== undefined) found.set(one.id, one.properties.sanctions);
  return found;
};
