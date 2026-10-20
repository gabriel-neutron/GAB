import { chainView, type Card } from '@gab/release/chain-card';
import { chainFlows } from '@gab/release/chain-flows';
import { chainMapData } from '@gab/release/chain-map-data';
import { mapFeatures } from '@gab/release/map-features';
import type { SiteManifest } from '@gab/release/site-manifest';
import type { SiteRelease } from '@gab/release/site-release';
import { stagedGeojson } from '@gab/release/staged-geojson';
import type { VolumeLine } from '@gab/release/volume-card';
import { PRODUCTS, type ProductKey } from '@gab/proposal/chain-product';
import { STAGES, type StageKey } from '@gab/proposal/chain-stage';
import { chainSteps, type ChainStep } from '@gab/proposal/chain-steps';
import countries from '@gab/proposal/countries.json?raw';
import { positions, type Position } from '@gab/proposal/geometry-positions';
import { outsideRussia } from '@gab/proposal/outside-russia';
import { z } from 'zod';

import { typeCounts, type TypeCount } from './type-counts';

const outside = outsideRussia(countries);

const position = z.array(z.number());
const geometry = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'), coordinates: position }),
  z.object({ type: z.literal('LineString'), coordinates: z.array(position) }),
  z.object({ type: z.literal('MultiLineString'), coordinates: z.array(z.array(position)) }),
  z.object({ type: z.literal('Polygon'), coordinates: z.array(z.array(position)) }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(z.array(position))),
  }),
]);

const entityCollection = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(
    z.object({
      type: z.literal('Feature'),
      id: z.string(),
      geometry,
      properties: z.record(z.string(), z.unknown()),
    }),
  ),
});

/** The entities of the release with a position, with the stage and its hue on each feature. */
export type EntityCollection = z.infer<typeof entityCollection>;

/** What the link of a card says, and what it carries. */
export interface ArcInfo {
  readonly id: string;
  readonly label: string;
  readonly product: ProductKey;
  readonly inReview: boolean;
  readonly volumes: readonly VolumeLine[];
}

export interface ExitInfo {
  readonly id: string;
  readonly label: string;
  readonly why: string;
  readonly inReview: boolean;
}

/** One line of the list of the entities. */
export interface EntityRow {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly stage: string;
  readonly geometry: string;
}

/** The counts that the page says in words. */
export interface GlobeCounts {
  readonly entities: number;
  /** Each type of the record: how many entities it holds, and how many the map draws. */
  readonly byType: readonly TypeCount[];
  readonly arcs: number;
  readonly arcsInReview: number;
  readonly arcsWithVolume: number;
  readonly exitsInReview: number;
  readonly exitsNotPlaced: number;
  readonly byProduct: readonly { readonly label: string; readonly links: number }[];
  readonly byStage: readonly { readonly label: string; readonly assets: number }[];
}

/** Everything the globe and its panels read from one release. */
export interface GlobeData {
  /** The day of the release, YYYY-MM-DD. */
  readonly date: string;
  readonly manifest: SiteManifest;
  readonly entities: EntityCollection;
  readonly arcs: ReturnType<typeof chainMapData>['arcs'];
  readonly exits: ReturnType<typeof chainMapData>['exits'];
  /** The links that a highlight follows. */
  readonly links: ReturnType<typeof chainMapData>['links'];
  readonly steps: readonly ChainStep[];
  readonly cards: Readonly<Record<string, Card>>;
  readonly stages: ReadonlyMap<string, StageKey | null>;
  readonly arcInfo: Readonly<Record<string, ArcInfo>>;
  readonly exitInfo: Readonly<Record<string, ExitInfo>>;
  readonly rows: readonly EntityRow[];
  readonly counts: GlobeCounts;
  /** The positions of each entity, arc and exit point, by identifier. The camera frames them. */
  readonly places: ReadonlyMap<string, readonly Position[]>;
}

/** The globe of a release: the entities with their stage, the physical links, the exit points,
 * the six steps and the card of each entity. A pure derivation, so a test reads it without a
 * browser. */
export function globeData(release: SiteRelease): GlobeData {
  const view = chainView(release);
  const flows = chainFlows(release, view.stages, outside);
  const mapData = chainMapData(flows);
  const entities = entityCollection.parse(JSON.parse(stagedGeojson(release.geojson, flows.stages)));
  const stageLabel = (id: string): string =>
    STAGES.find((one) => one.key === flows.stages.get(id))?.label ?? '';

  const arcInfo: Record<string, ArcInfo> = {};
  for (const [index, arc] of flows.arcs.entries()) {
    const link = mapData.links.arcs[index];
    arcInfo[arc.id] = {
      id: arc.id,
      label: `${arc.fromLabel} to ${arc.toLabel}`,
      product: arc.product,
      inReview: arc.inReview,
      volumes: link?.volumes ?? [],
    };
  }
  const exitInfo: Record<string, ExitInfo> = {};
  for (const exit of flows.exits)
    exitInfo[exit.id] = {
      id: exit.id,
      label: exit.label,
      why: exit.why,
      inReview: exit.inReview,
    };

  const places = new Map<string, readonly Position[]>([
    ...entities.features.map((one) => [one.id, positions(one.geometry.coordinates)] as const),
    ...flows.arcs.map((one) => [one.id, one.path] as const),
    ...flows.exits.flatMap((one) =>
      one.position === null ? [] : [[one.id, [one.position]] as const],
    ),
  ]);

  return {
    date: release.manifest.date,
    manifest: release.manifest,
    entities,
    arcs: mapData.arcs,
    exits: mapData.exits,
    links: mapData.links,
    steps: chainSteps(flows),
    cards: view.cards,
    stages: flows.stages,
    arcInfo,
    exitInfo,
    rows: mapFeatures(release.geojson).map((one) => ({
      id: one.id,
      label: one.label,
      type: one.type,
      stage: stageLabel(one.id),
      geometry: one.geometry,
    })),
    counts: {
      entities: entities.features.length,
      byType: typeCounts(release.entities, mapFeatures(release.geojson)),
      arcs: flows.arcs.length,
      arcsInReview: flows.arcs.filter((one) => one.inReview).length,
      arcsWithVolume: flows.arcs.filter((one) => one.volume !== null).length,
      exitsInReview: flows.exits.filter((one) => one.inReview).length,
      exitsNotPlaced: flows.exits.filter((one) => one.position === null).length,
      byProduct: PRODUCTS.map((one) => ({
        label: one.label,
        links: flows.arcs.filter((arc) => arc.product === one.key).length,
      })),
      byStage: STAGES.map((one) => ({
        label: one.label,
        assets: flows.counts.get(one.key) ?? 0,
      })),
    },
    places,
  };
}
