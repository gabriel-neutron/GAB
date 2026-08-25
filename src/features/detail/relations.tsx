// M6 writes an interval at both ends: the retrieval date, and the identity or ownership
// interval. `relation.undrawable` is computed from the relation, never from the list position.

import type { ReactNode } from 'react';

import type { RelationLine, SourceRef } from './dossier';

export interface RelationsProps {
  readonly relations: readonly RelationLine[];
  readonly mark: (sources: readonly SourceRef[]) => ReactNode;
}

const UNDRAWABLE = 'The graph does not draw this relation. One endpoint is a relation.';

export function Relations({ relations, mark }: RelationsProps) {
  if (relations.length === 0) {
    return (
      <section aria-label="Relations">
        <p className="text-xs text-label">
          0 relations. No relation has an endpoint on this entity, and none was dropped.
        </p>
      </section>
    );
  }

  return (
    <section aria-label="Relations">
      <ul>
        {relations.map((relation) => (
          <li key={relation.id} data-relation={relation.id} className="border-b border-border py-1">
            <div className="flex items-center gap-2">
              {/* Tailwind: `truncate` does nothing in a flex row without `min-w-0`. */}
              <span className="min-w-0 flex-1 truncate text-xs" title={relation.sentence}>
                {relation.sentence}
              </span>
              {/* M6: the interval is written at both ends. `./dossier` already wrote the
                  words, including "and closed". */}
              {relation.interval === null ? null : (
                <span
                  className="max-w-64 shrink-0 truncate font-mono text-small/4 tabular-nums text-label"
                  title={relation.interval}
                >
                  {relation.interval}
                </span>
              )}
              {mark(relation.sources)}
            </div>
            {/* M4: a relation can have a relation at an endpoint. The mark comes from
                the relation itself. */}
            {relation.undrawable ? <p className="text-small/4 text-label">{UNDRAWABLE}</p> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
