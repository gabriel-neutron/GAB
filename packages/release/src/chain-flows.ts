import {
  chainFlows as sharedFlows,
  type ChainArc as SharedArc,
  type ChainFlows as SharedFlows,
} from '@gab/proposal/chain-flows';
import type { StageKey } from '@gab/proposal/chain-stage';
import { positions, type Position } from '@gab/proposal/geometry-positions';
import { z } from 'zod';

import { isAccepted } from './accepted.ts';
import { drawnVolume } from './arc-volume.ts';
import type { SiteRelease, SiteVolume } from './site-release.ts';

export type { ExitPoint } from '@gab/proposal/chain-flows';

/** One physical link of the chain, with its rows of the volume table. */
export interface ChainArc extends SharedArc {
  /** The volume that the map draws, or null when the volume table has no row for the link. */
  readonly volume: SiteVolume | null;
  /** Each row of the volume table for the link, for the card. */
  readonly volumes: readonly SiteVolume[];
}

export interface ChainFlows extends SharedFlows {
  readonly arcs: readonly ChainArc[];
}

const collection = z.looseObject({
  features: z.array(
    z.looseObject({ id: z.string(), geometry: z.looseObject({ coordinates: z.unknown() }) }),
  ),
});

/** The chain of the release, with the volumes of the research on its arcs. `outside` tells if a
 * position is outside Russia. */
export const chainFlows = (
  release: SiteRelease,
  kindStages: ReadonlyMap<string, StageKey | null>,
  outside: (position: Position) => boolean,
): ChainFlows => {
  const flows = sharedFlows(
    {
      placed: new Map(
        collection
          .parse(JSON.parse(release.geojson))
          .features.map((one) => [one.id, positions(one.geometry.coordinates)] as const),
      ),
      entityAccepted: (id) => {
        const entity = release.entityById.get(id);
        return entity !== undefined && isAccepted(entity.originLabel);
      },
      relations: release.relations.map((one) => ({
        ...one,
        accepted: isAccepted(one.originLabel),
      })),
    },
    kindStages,
    outside,
  );
  return {
    ...flows,
    arcs: flows.arcs.map((arc) => {
      const volumes = release.volumesOfRelation.get(arc.id) ?? [];
      return { ...arc, volume: drawnVolume(volumes), volumes };
    }),
  };
};
