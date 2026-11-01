// The prototypes of the graph. A variant sets how a relation family pulls, how the forces run and
// how large a node is, so one corpus is read in several ways. Each reads the same shown nodes: a
// variant never hides an entity that the filter keeps.

import type { RelationFamily } from './relation-families';

export interface ForceSettings {
  readonly linLogMode: boolean;
  readonly strongGravityMode: boolean;
  readonly gravity: number;
  readonly scalingRatio: number;
  readonly outboundAttractionDistribution: boolean;
}

export type VariantId = 'power' | 'concentration' | 'links' | 'groups';

export interface Variant {
  readonly id: VariantId;
  readonly label: string;
  /** What the variant shows, in one line, for the title of its button. */
  readonly reading: string;
  /** The pull of one relation of each family: a heavy family draws its two nodes closer. */
  readonly weights: Readonly<Record<RelationFamily, number>>;
  readonly forces: ForceSettings;
  /** The radius of a node, from its share of the strongest node in view, in [0, 1]. */
  readonly sizeOf: (share: number) => number;
  /** The run starts with each type in its own sector, and a weak pull keeps the sectors. */
  readonly seedByType: boolean;
}

const flat = (weight: number): Readonly<Record<RelationFamily, number>> => ({
  ownership: weight,
  designation: weight,
  operation: weight,
  transfer: weight,
  other: weight,
});

const POWER: Variant = {
  id: 'power',
  label: 'Power',
  reading: 'Ownership and operation bind groups; a node grows with the weight of its relations.',
  // Ownership is control, so it binds hardest. A designation is a legal fact about one node,
  // and a list names hundreds of nodes, so it binds little: it must not fold the whole graph.
  weights: { ownership: 4, operation: 2.5, transfer: 1.5, designation: 0.6, other: 0.5 },
  forces: {
    linLogMode: true,
    strongGravityMode: false,
    gravity: 0.2,
    scalingRatio: 12,
    outboundAttractionDistribution: true,
  },
  sizeOf: (share) => 4 + 30 * Math.sqrt(share),
  seedByType: false,
};

export const VARIANTS: readonly Variant[] = [
  POWER,
  {
    id: 'concentration',
    label: 'Concentration',
    reading:
      'A node of many relations grows and draws to the middle; the satellites stand around it.',
    weights: flat(1),
    forces: {
      linLogMode: false,
      strongGravityMode: true,
      gravity: 1,
      scalingRatio: 8,
      outboundAttractionDistribution: false,
    },
    // A linear size: only a true hub is large, and the rest stay small.
    sizeOf: (share) => 4 + 36 * share,
    seedByType: false,
  },
  {
    id: 'links',
    label: 'Links',
    reading: 'Each connected group stands apart, so the links between entities read first.',
    weights: { ownership: 4, operation: 3, transfer: 3, designation: 1, other: 1 },
    forces: {
      linLogMode: true,
      strongGravityMode: false,
      gravity: 0.05,
      scalingRatio: 25,
      outboundAttractionDistribution: true,
    },
    sizeOf: () => 7,
    seedByType: false,
  },
  {
    id: 'groups',
    label: 'Groups',
    reading: 'Each type keeps its own sector, and the relations cross from one sector to another.',
    // A weak pull and a gravity: the sectors of the seed stay, and only the strongest
    // relations bring two nodes of different types closer.
    weights: { ownership: 1, operation: 0.8, transfer: 0.8, designation: 0.3, other: 0.3 },
    forces: {
      linLogMode: false,
      strongGravityMode: false,
      gravity: 0.5,
      scalingRatio: 10,
      outboundAttractionDistribution: false,
    },
    sizeOf: (share) => 5 + 14 * Math.sqrt(share),
    seedByType: true,
  },
];

export const DEFAULT_VARIANT: Variant = POWER;

export const variantOf = (id: VariantId): Variant =>
  VARIANTS.find((variant) => variant.id === id) ?? DEFAULT_VARIANT;
