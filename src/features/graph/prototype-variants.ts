/**
 * PROTOTYPE — throwaway. The register of the three variants.
 *
 * Three variants of the graph view on `/graph`, switched by `?variant=`, with `?n=` for the
 * entity count. The route reads those two search parameters and this folder never does: a search
 * parameter changes React state, and ADR 0004 §3 refuses React state inside the feature.
 *
 * The question this prototype answers: **what does the analyst read at ten thousand entities,
 * and what does it cost?** It reports to #35, #10 and #33, and it settles none of them.
 */

import type { ComponentType } from 'react';
import { VariantA } from './variant-a';
import { VariantB } from './variant-b';
import { VariantC } from './variant-c';

export interface VariantEntry {
  readonly key: string;
  readonly name: string;
  readonly Component: ComponentType<{ entityCount: number }>;
}

export const GRAPH_VARIANTS: readonly VariantEntry[] = [
  { key: 'A', name: 'Immersive canvas', Component: VariantA },
  { key: 'B', name: 'Findings rail', Component: VariantB },
  { key: 'C', name: 'Three bands', Component: VariantC },
];

/** The sizes the cost curve of #35 is measured at. */
export const ENTITY_COUNTS: readonly number[] = [1000, 5000, 10000, 25000];
