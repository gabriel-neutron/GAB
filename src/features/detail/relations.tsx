/**
 * The relations of one entity, including the ones the graph cannot draw.
 *
 * Built from `docs/detail-surface.md` §4.6, and from the findings §3.5 and §5.1. M6 writes an
 * interval at both ends, and §5.1 puts a mark to the sources on every line.
 *
 * The lines arrive ready from `./dossier`: the direct relations first, then the relations that
 * point at those relations, deduplicated. This file re-orders nothing and computes nothing, so
 * it holds exactly one `.map`.
 *
 * **The defect this file exists to not repeat (§3.5).** The `contradicts` relation of the probe
 * is a **direct** relation of the entity and an invisible one at the same time. A first version
 * marked it from the list it was placed in, and the mark vanished. `relation.undrawable` is
 * computed from the relation, and this file reads that property and nothing else. **Never take
 * the mark from the position in the list, and never from which array a relation came in.**
 */

import type { ReactNode } from 'react';

import type { RelationLine, SourceRef } from './dossier';

export interface RelationsProps {
  /** Already found, already ordered, already marked. `./dossier` decides all three. */
  readonly relations: readonly RelationLine[];
  /** The mark of §5.1. The caller owns which source is active and what a click does. */
  readonly mark: (sources: readonly SourceRef[]) => ReactNode;
}

/**
 * §4.6: an undrawable relation says in words that the graph does not draw it, and names the ADR
 * that records why. It is a sentence, and never a hue alone and never an icon alone.
 *
 * The words carry no hue. The theme keeps two hues at rest — `candidate` for the machine layer
 * and `dissent` for a disagreement between agents — and this relation is neither of the two.
 */
const UNDRAWABLE =
  'The graph does not draw this relation, because one endpoint is a relation. ADR 0004 §4.';

export function Relations({ relations, mark }: RelationsProps) {
  if (relations.length === 0) {
    return (
      <section aria-label="Relations">
        {/* The count and the reason in one sentence. No icon, and no friendly line. */}
        <p className="text-xs text-label">
          0 relations. The record carries no relation with an endpoint on this entity, and none was
          dropped.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Relations">
      <ul>
        {relations.map((relation) => (
          // Rule 3: one border level. The hairline separates two relations, and nothing inside
          // a line carries a second one.
          <li key={relation.id} data-relation={relation.id} className="border-b border-border py-1">
            <div className="flex items-center gap-2">
              {/* Rule 16: a value truncates and the full one appears on hover. `truncate` alone
                  does nothing in a flex row, so `min-w-0` sits beside it. */}
              <span className="min-w-0 flex-1 truncate text-xs" title={relation.sentence}>
                {relation.sentence}
              </span>
              {/* M6: the interval is written at both ends, and `./dossier` already wrote the
                  words, including "and closed". A closed interval never reads as current. */}
              {relation.interval === null ? null : (
                <span
                  className="max-w-64 shrink-0 truncate font-mono text-[11px]/4 tabular-nums text-label"
                  title={relation.interval}
                >
                  {relation.interval}
                </span>
              )}
              {/* §5.1: the mark is last on the line, and it is inside nothing that can hide it. */}
              {mark(relation.sources)}
            </div>
            {/* §3.5: the mark of an M4 relation comes from the relation. */}
            {relation.undrawable ? <p className="text-[11px]/4 text-label">{UNDRAWABLE}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
