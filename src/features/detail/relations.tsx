// M6 writes an interval at both ends: the retrieval date, and the identity or ownership
// interval. `relation.undrawable` is computed from the relation, never from the list position.

import type { ReactNode } from 'react';

import { DeleteControl } from './delete-control';
import type { RelationLine, SourceRef } from './dossier';

/** Whether this list offers the deletion of a line. A panel beside a canvas offers none, and
 * `busy` then names nothing: the two states cannot be held at once. */
export type RelationDeletion =
  | { readonly offered: false }
  | {
      readonly offered: true;
      /** One act at a time. A second act while one is in flight writes a second proposal. */
      readonly busy: boolean;
      readonly onDelete: (relationId: string) => void;
    };

export interface RelationsProps {
  readonly relations: readonly RelationLine[];
  readonly mark: (sources: readonly SourceRef[]) => ReactNode;
  readonly deleting: RelationDeletion;
}

const UNDRAWABLE = 'The graph does not draw this relation. One endpoint is a relation.';

export function Relations({ relations, mark, deleting }: RelationsProps) {
  if (relations.length === 0) {
    return (
      <p className="text-xs text-label">
        0 relations. No relation has an endpoint on this entity, and none was dropped.
      </p>
    );
  }

  return (
    <ul>
      {relations.map((relation) => (
        <li key={relation.id} data-relation={relation.id} className="border-b border-border py-1">
          <div className="flex items-center gap-2">
            {/* Tailwind: `truncate` does nothing in a flex row without `min-w-0`. */}
            <span className="min-w-0 flex-1 truncate text-xs" title={relation.sentence}>
              {relation.sentence}
            </span>
            {/* M6: the interval is written at both ends. The words arrive written, and
                  "and closed" is among them. */}
            {relation.interval === null ? null : (
              <span
                className="max-w-64 shrink-0 truncate font-mono text-small/4 tabular-nums text-label"
                title={relation.interval}
              >
                {relation.interval}
              </span>
            )}
            {mark(relation.sources)}
            {deleting.offered ? (
              <DeleteControl
                name={relation.sentence}
                busy={deleting.busy}
                onDelete={() => {
                  deleting.onDelete(relation.id);
                }}
              />
            ) : null}
          </div>
          {/* M4: a relation can have a relation at an endpoint. The mark comes from
                the relation itself. */}
          {relation.undrawable ? <p className="text-small/4 text-label">{UNDRAWABLE}</p> : null}
        </li>
      ))}
    </ul>
  );
}
