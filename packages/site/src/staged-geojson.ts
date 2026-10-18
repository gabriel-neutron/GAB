import { z } from 'zod';

import { NO_STAGE_COLOUR, STAGES, type StageKey } from '@gab/proposal/chain-stage';

const collection = z.looseObject({
  features: z.array(
    z.looseObject({ id: z.string(), properties: z.record(z.string(), z.unknown()) }),
  ),
});

/** The GeoJSON of the release with the stage and its colour added to each feature. The file of the
 * release itself does not change. */
export const stagedGeojson = (
  geojson: string,
  stages: ReadonlyMap<string, StageKey | null>,
): string => {
  const read = collection.parse(JSON.parse(geojson));
  return JSON.stringify({
    ...read,
    features: read.features.map((one) => {
      const stage = STAGES.find((each) => each.key === stages.get(one.id));
      return {
        ...one,
        properties: {
          ...one.properties,
          stage: stage?.label ?? '',
          stageKey: stage?.key ?? '',
          colour: stage?.colour ?? NO_STAGE_COLOUR,
        },
      };
    }),
  });
};
