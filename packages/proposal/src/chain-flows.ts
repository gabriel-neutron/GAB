import { arcCurve } from './arc-curve.ts';
import { PRODUCTS, type ProductKey } from './chain-product.ts';
import { STAGES, type StageKey } from './chain-stage.ts';
import type { Position } from './geometry-positions.ts';

/** One physical link between two assets with a position, drawn as a curved line. */
export interface ChainArc {
  readonly id: string;
  readonly product: ProductKey;
  readonly fromId: string;
  readonly fromLabel: string;
  readonly toId: string;
  readonly toLabel: string;
  readonly path: readonly Position[];
  /** The link starts at the export stage or later, or ends outside Russia. */
  readonly afterExport: boolean;
  /** The link, or one of its two assets, is still a proposal. */
  readonly inReview: boolean;
}

/** A point where the product leaves Russian control. It is computed from the relations: it is
 * not an entity of the record. */
export interface ExitPoint {
  readonly id: string;
  readonly kind: 'port_sale' | 'sts' | 'border';
  readonly label: string;
  /** Why the point is an exit point, in words for the card. */
  readonly why: string;
  /** Null when no entity of the exit point has a position: the map cannot draw it. */
  readonly position: Position | null;
  /** The entities that put the exit point forward: the port of a sale, the two vessels of a
   * transfer, and the asset abroad of a handover. */
  readonly assets: readonly string[];
  readonly inReview: boolean;
}

export interface ChainFlows {
  readonly arcs: readonly ChainArc[];
  readonly exits: readonly ExitPoint[];
  /** The stage of each entity with a position. A declared destination replaces the stage of the
   * asset kind. */
  readonly stages: ReadonlyMap<string, StageKey | null>;
  /** The count of each stage: the accepted assets, and for the exit stage the accepted exit
   * points. */
  readonly counts: ReadonlyMap<StageKey, number>;
}

/** One relation that the chain reads: a physical link, a loading or a discharge at a port, or a
 * ship-to-ship transfer. Each other relation is ignored. */
export interface ChainRelation {
  readonly id: string;
  readonly type: string;
  readonly fromId: string;
  readonly fromLabel: string;
  readonly toId: string;
  readonly toLabel: string;
  /** False for a relation that is still a proposal. */
  readonly accepted: boolean;
}

/** What the chain reads. The site gives it from a release, and the application from its corpus
 * and its pending proposals. */
export interface ChainInput {
  /** The positions of each entity that has one. */
  readonly placed: ReadonlyMap<string, readonly Position[]>;
  /** False for an entity that is still a proposal. */
  readonly entityAccepted: (id: string) => boolean;
  readonly relations: readonly ChainRelation[];
}

const squared = ([x0, y0]: Position, [x1, y1]: Position): number => (x1 - x0) ** 2 + (y1 - y0) ** 2;

const nearest = (all: readonly Position[], to: Position): Position | undefined =>
  all.reduce<Position | undefined>(
    (best, one) => (best === undefined || squared(one, to) < squared(best, to) ? one : best),
    undefined,
  );

const rank = (stage: StageKey | null | undefined): number =>
  STAGES.findIndex((one) => one.key === stage);

const EXPORT_RANK = rank('export');

const productWords = (product: ProductKey): string =>
  PRODUCTS.find((one) => one.key === product)?.label.toLowerCase() ?? product;

/** The arcs, the exit points and the six stages of the chain view, from the relations.
 * `kindStages` gives the stage of each entity from its asset kind, and `outside` tells if a
 * position is outside Russia. */
export const chainFlows = (
  input: ChainInput,
  kindStages: ReadonlyMap<string, StageKey | null>,
  outside: (position: Position) => boolean,
): ChainFlows => {
  const placed = new Map([...input.placed].filter(([, all]) => all.length > 0));
  const anchor = (id: string): Position | undefined => {
    const all = placed.get(id);
    return all?.[Math.floor(all.length / 2)];
  };
  // An asset with no position is neither in Russia nor outside: the map cannot tell.
  const isOutside = (id: string): boolean => {
    const at = anchor(id);
    return at !== undefined && outside(at);
  };
  const isInside = (id: string): boolean => {
    const at = anchor(id);
    return at !== undefined && !outside(at);
  };
  const inReview = (relation: ChainRelation): boolean =>
    !relation.accepted ||
    !input.entityAccepted(relation.fromId) ||
    !input.entityAccepted(relation.toId);

  const links = input.relations.flatMap((relation) => {
    const product = PRODUCTS.find((one) => one.relationType === relation.type)?.key;
    return product === undefined ? [] : [{ relation, product }];
  });

  // A declared destination: the far end of an accepted physical link from Russia, or a place
  // outside Russia where a vessel that loads in Russia discharges (an LNG carrier from Arctic
  // LNG 2 to Beihai). Both relations of the vessel are accepted.
  const stages = new Map(kindStages);
  for (const { relation } of links)
    if (!inReview(relation) && isOutside(relation.toId) && isInside(relation.fromId))
      stages.set(relation.toId, 'destination');
  const loadsInRussia = new Set(
    input.relations
      .filter((one) => one.type === 'loads_at' && !inReview(one) && isInside(one.toId))
      .map((one) => one.fromId),
  );
  for (const relation of input.relations)
    if (
      relation.type === 'discharges_at' &&
      !inReview(relation) &&
      isOutside(relation.toId) &&
      loadsInRussia.has(relation.fromId)
    )
      stages.set(relation.toId, 'destination');

  const arcs = links.flatMap(({ relation, product }): ChainArc[] => {
    const fromAll = placed.get(relation.fromId);
    const toAll = placed.get(relation.toId);
    const fromAnchor = anchor(relation.fromId);
    const toAnchor = anchor(relation.toId);
    if (fromAll === undefined || toAll === undefined) return [];
    if (fromAnchor === undefined || toAnchor === undefined) return [];
    const start = nearest(fromAll, toAnchor) ?? fromAnchor;
    const end = nearest(toAll, fromAnchor) ?? toAnchor;
    return [
      {
        id: relation.id,
        product,
        fromId: relation.fromId,
        fromLabel: relation.fromLabel,
        toId: relation.toId,
        toLabel: relation.toLabel,
        path: arcCurve(start, end),
        afterExport: rank(stages.get(relation.fromId)) >= EXPORT_RANK || isOutside(relation.toId),
        inReview: inReview(relation),
      },
    ];
  });

  const exits: ExitPoint[] = [];
  const loadings = Map.groupBy(
    input.relations.filter((one) => one.type === 'loads_at' && isInside(one.toId)),
    (one) => one.toId,
  );
  for (const [place, relations] of loadings) {
    const accepted = relations.filter((one) => !inReview(one));
    const review = accepted.length === 0;
    const vessels = new Set((review ? relations : accepted).map((one) => one.fromId)).size;
    const label = relations[0]?.toLabel ?? place;
    const words = vessels === 1 ? '1 vessel loads' : `${String(vessels)} vessels load`;
    exits.push({
      id: `exit-sale-${place}`,
      kind: 'port_sale',
      label: `Sale at ${label}`,
      why: `${review ? 'In review, not a fact. ' : ''}Sale at a Russian port: ${words} at ${label}.`,
      position: anchor(place) ?? null,
      assets: [place],
      inReview: review,
    });
  }
  for (const relation of input.relations.filter((one) => one.type === 'sts_with')) {
    const review = inReview(relation);
    exits.push({
      id: `exit-sts-${relation.id}`,
      kind: 'sts',
      label: 'Ship-to-ship transfer',
      why: `${review ? 'In review, not a fact. ' : ''}Ship-to-ship transfer: ${relation.fromLabel} and ${relation.toLabel}.`,
      position: anchor(relation.fromId) ?? anchor(relation.toId) ?? null,
      assets: [relation.fromId, relation.toId],
      inReview: review,
    });
  }
  for (const { relation, product } of links) {
    if (!isOutside(relation.toId) || !isInside(relation.fromId)) continue;
    const review = inReview(relation);
    exits.push({
      id: `exit-border-${relation.id}`,
      kind: 'border',
      label: 'Handover at the border',
      why: `${review ? 'In review, not a fact. ' : ''}Handover at the border: ${relation.fromLabel} sends ${productWords(product)} to ${relation.toLabel}, outside Russia.`,
      position: anchor(relation.toId) ?? null,
      assets: [relation.toId],
      inReview: review,
    });
  }

  const counts = new Map<StageKey, number>(STAGES.map((one) => [one.key, 0]));
  for (const stage of stages.values())
    if (stage !== null) counts.set(stage, (counts.get(stage) ?? 0) + 1);
  counts.set('exit', exits.filter((one) => !one.inReview).length);
  return { arcs, exits, stages, counts };
};
