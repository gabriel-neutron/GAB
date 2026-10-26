// M6: an interval is written at both ends, and a closed interval says that it is closed.
// `relation.undrawable` is computed from the relation, never from the list position.

import type { ReactNode } from 'react';

import { DeleteControl } from './delete-control';
import type { RelationLine, SourceRef } from './dossier';
import { FAMILIES } from './family';
import { FamilySample } from './family-sample';
import { EntityGlyph } from './glyph';
import { CAPTION, DATA, GHOST_LINK } from './style';

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

/** The hover text of a line: the sentence, then the meaning of its type where the record has it. */
const hoverOf = (relation: RelationLine): string =>
  relation.definition === null ? relation.sentence : `${relation.sentence}. ${relation.definition}`;

const UNDRAWABLE = 'The graph does not draw this relation. One endpoint is a relation.';

export function Relations({ relations, mark, deleting, onSelect, claimHref }: RelationsProps) {
  const claimLink = (id: string): string | null => claimHref?.(id) ?? null;
  if (relations.length === 0) {
    return (
      <p className="text-body-sm text-muted-foreground">
        0 relations. No relation has an endpoint on this entity, and none was dropped.
      </p>
    );
  }

  // Rows stand in groups by family. Each group names its family with the sample of its line.
  return (
    <div className="flex flex-col gap-4">
      {FAMILIES.map((look) => {
        const group = relations.filter((relation) => relation.family === look.key);
        if (group.length === 0) return null;
        return (
          <div key={look.key} role="group" aria-label={look.label} className="flex flex-col gap-1">
            <p className={`flex items-center gap-2 ${CAPTION}`}>
              <FamilySample look={look} />
              <span>{look.label}</span>
            </p>
            <ul>
              {group.map((relation) => (
                <li
                  key={relation.id}
                  data-relation={relation.id}
                  className="flex flex-col gap-1 border-b border-divider py-2 last:border-b-0"
                >
                  <div className="flex flex-wrap items-start gap-x-2 gap-y-1">
                    <span className="flex h-5 items-center">
                      <EntityGlyph type={relation.otherType ?? 'unknown'} />
                    </span>
                    {onSelect === undefined ? (
                      <span
                        className="min-w-0 flex-1 basis-48 text-body-sm break-words"
                        title={hoverOf(relation)}
                      >
                        {relation.sentence}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="min-w-0 flex-1 basis-48 text-left text-body-sm break-words outline-none hover:underline hover:decoration-border hover:underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                        title={hoverOf(relation)}
                        onClick={() => {
                          onSelect(relation.id);
                        }}
                      >
                        {relation.sentence}
                      </button>
                    )}
                    {mark(relation.sources)}
                    {claimLink(relation.id) === null ? null : (
                      <a
                        className={`${GHOST_LINK} shrink-0 text-body-sm`}
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
                  {/* The qualifier stands under the sentence, in the instrument voice. M6: the
                      interval is written at both ends. The words arrive written, and "and closed"
                      is among them. */}
                  {relation.typeShown === null &&
                  relation.interval === null &&
                  relation.share === null &&
                  relation.facts.length === 0 ? null : (
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 pl-[22px]">
                      {relation.typeShown === null ? null : (
                        <span
                          data-relation-type=""
                          className={`min-w-0 break-words ${DATA} text-muted-foreground`}
                          title={relation.definition ?? undefined}
                        >
                          {`Type: ${relation.typeShown}`}
                        </span>
                      )}
                      {relation.interval === null ? null : (
                        <span className={`min-w-0 break-words ${DATA} text-muted-foreground`}>
                          {relation.interval}
                        </span>
                      )}
                      {relation.share === null ? null : (
                        <span className={`min-w-0 break-words ${DATA} text-muted-foreground`}>
                          {relation.share}
                        </span>
                      )}
                      {relation.facts.map((fact) => (
                        <span
                          key={fact}
                          className={`min-w-0 break-words ${DATA} text-muted-foreground`}
                        >
                          {fact}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* M4: a relation can have a relation at an endpoint. The mark comes from
                      the relation itself. */}
                  {relation.undrawable ? (
                    <p className="pl-[22px] text-body-sm text-muted-foreground">{UNDRAWABLE}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
