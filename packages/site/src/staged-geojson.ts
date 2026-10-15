import { z } from 'zod';

import type { ChainView } from './chain-card.ts';
import { NO_STAGE_COLOUR, STAGES } from './chain-stage.ts';

const collection = z.looseObject({
  features: z.array(
    z.looseObject({ id: z.string(), properties: z.record(z.string(), z.unknown()) }),
  ),
});

/** The GeoJSON of the release with the stage and its colour added to each feature. The file of the
 * release itself does not change. */
export const stagedGeojson = (geojson: string, view: ChainView): string => {
  const read = collection.parse(JSON.parse(geojson));
  return JSON.stringify({
    ...read,
    features: read.features.map((one) => {
      const stage = STAGES.find((each) => each.key === view.stages.get(one.id));
      return {
        ...one,
        properties: {
          ...one.properties,
          stage: stage?.label ?? '',
          colour: stage?.colour ?? NO_STAGE_COLOUR,
        },
      };
    }),
  });
};
