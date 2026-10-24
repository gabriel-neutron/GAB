import { chainFlows, type ChainFlows, type ChainRelation } from '@gab/proposal/chain-flows';
import { PRODUCTS } from '@gab/proposal/chain-product';
import { STAGES, stageOf, type StageKey } from '@gab/proposal/chain-stage';
import { chainSteps, type ChainStep } from '@gab/proposal/chain-steps';
import countries from '@gab/proposal/countries.json?raw';
import { outsideRussia } from '@gab/proposal/outside-russia';

import type { Corpus } from '@/shared/read/model';

import type { Projection } from './projection';

interface LineFeature {
  readonly type: 'Feature';
  readonly geometry: { readonly type: 'LineString'; readonly coordinates: readonly Position[] };
  readonly properties: {
    readonly id: string;
    readonly product: string;
    readonly colour: string;
    /** The types of the two ends, so a type that is switched off takes its arcs with it. */
    readonly fromType: string;
    readonly toType: string;
    /** A link in review is never drawn as a fact. A link after the export stage is dashed. */
    readonly style: 'solid' | 'dashed' | 'in review';
  };
}

interface PointFeature {
  readonly type: 'Feature';
  readonly geometry: { readonly type: 'Point'; readonly coordinates: Position };
  readonly properties: {
    readonly id: string;
    readonly inReview: boolean;
    /** The type of the first asset of the exit point, so the type filter reaches the ring. */
    readonly assetType: string;
  };
}

type Position = readonly [number, number];

/** The chain as the map draws it: the arcs and the exit points as GeoJSON, the colour of the
 * stage of each entity, and the six steps. */
export interface ChainView {
  readonly flows: ChainFlows;
  readonly steps: readonly ChainStep[];
  readonly stageColour: ReadonlyMap<string, string>;
  readonly arcs: { readonly type: 'FeatureCollection'; readonly features: readonly LineFeature[] };
  readonly exits: {
    readonly type: 'FeatureCollection';
    readonly features: readonly PointFeature[];
  };
}

const outside = outsideRussia(countries);

/** The chain of the corpus. A relation of the corpus is a promoted fact. A pending proposal of a
 * relation is in review: the map draws it in its own style, and no step counts it. */
export const chainView = (corpus: Corpus, projection: Projection): ChainView => {
  const labelOf = new Map(corpus.entities.map((entity) => [entity.id, entity.label]));
  const placed = new Map(
    projection.entities.map((entity) => [
      entity.id,
      // A pipeline that a route locates gives each point of its route, so an arc starts at the
      // point of the route nearest to the other asset.
      [[entity.lon, entity.lat] as const, ...(entity.route ?? []).flat()],
    ]),
  );
  const relation = (
    id: string,
    type: string,
    fromId: string,
    toId: string,
    accepted: boolean,
  ): ChainRelation => ({
    id,
    type,
    fromId,
    fromLabel: labelOf.get(fromId) ?? fromId,
    toId,
    toLabel: labelOf.get(toId) ?? toId,
    accepted,
  });
  const relations = [
    ...corpus.relations.flatMap((one) =>
      one.srcKind === 'entity' && one.dstKind === 'entity'
        ? [relation(one.id, one.type, one.srcId, one.dstId, true)]
        : [],
    ),
    ...corpus.proposals.flatMap(({ id, status, payload }) =>
      status === 'pending' &&
      payload.kind === 'relation' &&
      payload.src_kind === 'entity' &&
      payload.dst_kind === 'entity'
        ? [relation(id, payload.type, payload.src_id, payload.dst_id, false)]
        : [],
    ),
  ];
  const kindStages = new Map<string, StageKey | null>(
    projection.entities.map((entity) => {
      const kind = entity.attrs['asset_kind']?.v;
      return [entity.id, stageOf(entity.type, typeof kind === 'string' ? kind : undefined)];
    }),
  );
  const flows = chainFlows({ placed, entityAccepted: () => true, relations }, kindStages, outside);
  const colourOfStage = new Map<string, string>(STAGES.map((one) => [one.key, one.colour]));
  return {
    flows,
    steps: chainSteps(flows),
    stageColour: new Map(
      [...flows.stages].flatMap(([id, stage]) => {
        const colour = stage === null ? undefined : colourOfStage.get(stage);
        return colour === undefined ? [] : [[id, colour] as const];
      }),
    ),
    arcs: {
      type: 'FeatureCollection',
      features: flows.arcs.map((arc) => ({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: arc.path },
        properties: {
          id: arc.id,
          product: arc.product,
          colour: PRODUCTS.find((one) => one.key === arc.product)?.colour ?? '',
          fromType: projection.byId.get(arc.fromId)?.type ?? '',
          toType: projection.byId.get(arc.toId)?.type ?? '',
          style: arc.inReview ? 'in review' : arc.afterExport ? 'dashed' : 'solid',
        },
      })),
    },
    exits: {
      type: 'FeatureCollection',
      features: flows.exits.flatMap((exit) =>
        exit.position === null
          ? []
          : [
              {
                type: 'Feature',
                geometry: { type: 'Point', coordinates: exit.position },
                properties: {
                  id: exit.id,
                  inReview: exit.inReview,
                  assetType: projection.byId.get(exit.assets[0] ?? '')?.type ?? '',
                },
              },
            ],
      ),
    },
  };
};
