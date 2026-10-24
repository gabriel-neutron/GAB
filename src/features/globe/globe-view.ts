import { chainOf, productChain, type Highlight } from '@gab/proposal/chain-highlight';
import type { ProductKey } from '@gab/proposal/chain-product';
import type { StageKey } from '@gab/proposal/chain-stage';
import type { ChainStep } from '@gab/proposal/chain-steps';
import type { Position } from '@gab/proposal/geometry-positions';

import type { GlobeData } from './globe-data';

/** What the reader asked of the chain. An asset puts its chain forward, else a stage of the legend
 * puts its points forward, else a step puts its assets and its links forward, else the product
 * chain does. */
export interface Asked {
  readonly entity: string | null;
  readonly stage: StageKey | 'none' | null;
  readonly step: string | null;
  readonly product: ProductKey | 'all';
}

const stepSets = (step: ChainStep): Highlight => ({
  assets: new Set(step.assets),
  arcs: new Set(step.arcs),
  exits: new Set(step.exits),
});

// A stage is a set of points. The links between them are not a stage, so they all dim.
const stageSets = (data: GlobeData, stage: StageKey | 'none'): Highlight => ({
  assets: new Set(
    [...data.stages].filter(([, key]) => (key ?? 'none') === stage).map(([id]) => id),
  ),
  arcs: new Set(),
  exits: new Set(stage === 'exit' ? Object.keys(data.exitInfo) : []),
});

/** The assets, the links and the exit points that the globe puts forward, or null when it puts
 * none forward. The globe dims each other one. */
export const highlightOf = (data: GlobeData, asked: Asked): Highlight | null => {
  if (asked.entity !== null) return chainOf(data.links, asked.entity);
  if (asked.stage !== null) return stageSets(data, asked.stage);
  const step = data.steps.find((one) => one.key === asked.step);
  if (step !== undefined) return stepSets(step);
  return asked.product === 'all' ? null : productChain(data.links, asked.product);
};

/** The box that holds each place of the given identifiers, as [west, south] and [east, north], or
 * null when none of them has a place. */
export const frameOf = (
  places: ReadonlyMap<string, readonly Position[]>,
  ids: readonly string[],
): [[number, number], [number, number]] | null => {
  const all = ids.flatMap((id) => places.get(id) ?? []);
  if (all.length === 0) return null;
  const lons = all.map(([lon]) => lon);
  const lats = all.map(([, lat]) => lat);
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ];
};

/** One feature under a click, with the layer that drew it. */
export interface Under {
  readonly layer: string;
  readonly id: string;
}

export type Picked =
  | { readonly kind: 'none' }
  | { readonly kind: 'one'; readonly hit: Under }
  | { readonly kind: 'many'; readonly hits: readonly Under[] };

/** The features under a click, in groups from the top. A group that holds a feature wins over each
 * group after it. One feature opens its card. Several features of the group that wins give a
 * choice, except the last group, where the first feature opens: the hit box of a line is wide, and
 * two lines that cross do not need a question. A feature that two layers draw counts once. */
export const pickHit = (hits: readonly Under[], groups: readonly (readonly string[])[]): Picked => {
  for (const [place, group] of groups.entries()) {
    const found = new Map<string, Under>();
    for (const one of hits)
      if (group.includes(one.layer) && !found.has(one.id)) found.set(one.id, one);
    const [first, ...others] = [...found.values()];
    if (first === undefined) continue;
    if (others.length === 0 || place === groups.length - 1) return { kind: 'one', hit: first };
    return { kind: 'many', hits: [first, ...others] };
  }
  return { kind: 'none' };
};
