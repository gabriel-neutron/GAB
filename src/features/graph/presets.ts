// The presets of the graph: two ways to read one corpus. `all` draws every entity and every
// relation. `focus` draws the key entities and what they touch at one step, with every relation
// among them, so no drawn entity hides a link.

import type { RelationFamily } from './relation-families';

export type PresetId = 'focus' | 'all';

export const DEFAULT_PRESET: PresetId = 'all';

export const PRESETS: readonly { id: PresetId; label: string; reading: string }[] = [
  { id: 'focus', label: 'Focus', reading: 'The most connected entities and what they touch' },
  { id: 'all', label: 'All', reading: 'Every entity and every relation' },
];

// The focus keeps this many seeds. Origin: tuned on a screen: with twelve, the focus of release
// 2026-10-28 holds under a thousand entities, which a canvas can draw with its links readable.
export const FOCUS_SEEDS = 12;

interface Link {
  readonly source: string;
  readonly target: string;
  readonly family: RelationFamily;
}

/**
 * The entities of the focus: the seeds and their direct neighbours. The seeds are the entities
 * with the most operational links. A legal act lists hundreds of entities, so a link of
 * designation does not rank a seed.
 */
export function focusOf(links: readonly Link[]): ReadonlySet<string> {
  const degree = new Map<string, number>();
  for (const { source, target, family } of links) {
    if (family === 'designation' || source === target) continue;
    degree.set(source, (degree.get(source) ?? 0) + 1);
    degree.set(target, (degree.get(target) ?? 0) + 1);
  }
  const seeds = new Set(
    [...degree]
      .sort(([one, a], [two, b]) => b - a || one.localeCompare(two))
      .slice(0, FOCUS_SEEDS)
      .map(([node]) => node),
  );
  const kept = new Set(seeds);
  for (const { source, target } of links) {
    if (seeds.has(source)) kept.add(target);
    if (seeds.has(target)) kept.add(source);
  }
  return kept;
}
