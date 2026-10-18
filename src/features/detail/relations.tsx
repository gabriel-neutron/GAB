// M6: an interval is written at both ends, and a closed interval says that it is closed.
// `relation.undrawable` is computed from the relation, never from the list position.

import type { ReactNode } from 'react';

import { READING_LINK } from '@/shared/page/reading-link';

import { DeleteControl } from './delete-control';
import type { RelationLine, SourceRef } from './dossier';

/** Whether this list offers the deletion of a line. A panel beside a canvas offers none, and
 * `busy` then names nothing: the two states cannot be held at once. */
type RelationDeletion =
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
  /** A panel beside a canvas gives this, so a click puts the relation on the canvas and in the
   * sidebar. A list with no canvas beside it gives none, and the sentence then is plain text. */
  readonly onSelect?: (relationId: string) => void;
  /** The address of the claim page of a relation, or null where the release holds no such claim. */
  readonly claimHref?: (relationId: string) => string | null;
}

const UNDRAWABLE = 'The graph does not draw this relation. One endpoint is a relation.';

export function Relations({ relations, mark, deleting, onSelect, claimHref }: RelationsProps) {
  const claimLink = (id: string): string | null => claimHref?.(id) ?? null;
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
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            {/* Tailwind: `truncate` does nothing in a flex row without `min-w-0`. */}
            {onSelect === undefined ? (
              <span
                className="min-w-0 flex-1 basis-48 text-xs break-words"
                title={relation.sentence}
              >
                {relation.sentence}
              </span>
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 basis-48 text-left text-xs break-words underline-offset-2 hover:underline"
                title={relation.sentence}
                onClick={() => {
                  onSelect(relation.id);
                }}
              >
                {relation.sentence}
              </button>
            )}
            {/* M6: the interval is written at both ends. The words arrive written, and
                  "and closed" is among them. */}
            {relation.interval === null ? null : (
              <span
                className="min-w-0 font-mono text-small/4 tabular-nums text-label"
                title={relation.interval}
              >
                {relation.interval}
              </span>
            )}
            {relation.share === null ? null : (
              <span className="min-w-0 text-small/4 text-label" title={relation.share}>
                {relation.share}
              </span>
            )}
            {mark(relation.sources)}
            {claimLink(relation.id) === null ? null : (
              <a
                className={`${READING_LINK} shrink-0 text-xs`}
                href={claimLink(relation.id) ?? undefined}
                aria-label={`Claim: ${relation.sentence}`}
              >
                Claim
              </a>
            )}
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
