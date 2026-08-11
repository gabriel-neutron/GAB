/**
 * **PROTOTYPE — three readings of the same hundred claims.**
 *
 * The frame does not change: the record on the left, the sources on the right, one claim on one
 * line. What changes is how much the screen **says** and how much it **shows**. The operator's
 * rule for this round: the design explains the data, so a word that a shape can carry is a word
 * that goes.
 *
 * | Key | Reading | What it bets on |
 * |---|---|---|
 * | A | Grouped | The name of the claim is enough, if the claims are in the right company. |
 * | B | Bare table | A box around a value that cannot be edited is 100 boxes of noise. |
 * | C | Folded | A hundred claims is nine lines until the analyst asks for more. |
 *
 * All three drop the sentence under the value, the type word, the word "disabled" and the score
 * beside the claim. The score is in the rail, once for each document.
 */

import { useState, type ReactNode } from 'react';
import type { DocId, Entity } from '@/shared/fixtures/types';
import { keyToLabel } from './attribute-shape';
import { attributeEntries } from './prototype-data';
import { ClaimRow, groupClaims, ValueControl, ValueText } from './prototype-parts';

export interface ClaimsViewProps {
  readonly entity: Entity;
  readonly badges: (ids: readonly DocId[]) => ReactNode;
  /** The sidebar is 24 rem wide, so a name column that suits the page starves the value. */
  readonly compact: boolean;
}

/* ------------------------------------------------------------------------------ A — grouped */

/**
 * The claims stand in named groups, in a fixed order, with a hairline and a small header. The
 * group is what tells the reader that `beam moulded m` is a dimension and not a certificate, so
 * no row has to say it.
 *
 * The groups are **invented from the name of the key** — the model carries none. That is the
 * point of showing it: it makes the missing metadata of #46 visible.
 */
export function GroupedClaims({ entity, badges, compact }: ClaimsViewProps) {
  return (
    <div>
      {groupClaims(entity).map((group) => (
        <section key={group.label} className="pb-2">
          <h3 className="sticky top-0 z-10 flex items-baseline gap-2 bg-background pt-2 text-[0.7rem] font-medium tracking-widest uppercase">
            {group.label}
            <span className="font-mono text-muted-foreground">{group.entries.length}</span>
            <span className="h-px flex-1 bg-border" />
          </h3>
          {group.entries.map(([key, attribute]) => (
            <ClaimRow
              key={key}
              attributeKey={key}
              attribute={attribute}
              badges={badges(attribute.src)}
              compact={compact}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

/* --------------------------------------------------------------------------- B — bare table */

/**
 * No box at rest. The value is text, and the **shape of the text is the type**: a number is
 * monospace and aligned right, a date is monospace, a boolean is a tick or a dash, a list ends
 * with its count. The field appears under the pointer, so the shape of an edit surface is still
 * shown, and a hundred grey boxes are not.
 *
 * One column head, and it is the only place the columns are named.
 */
export function TableClaims({ entity, badges, compact }: ClaimsViewProps) {
  const columns = compact
    ? 'grid-cols-[6.5rem_minmax(0,1fr)_auto]'
    : 'grid-cols-[11rem_18rem_auto]';

  return (
    <div>
      <div
        className={`grid ${columns} sticky top-0 z-10 gap-2 border-b border-border bg-background py-1 text-[0.7rem] tracking-widest text-muted-foreground uppercase`}
      >
        <span>Claim</span>
        <span>Value</span>
        <span>Src</span>
      </div>
      {attributeEntries(entity.attrs).map(([key, attribute]) => (
        <div
          key={key}
          className={`group grid ${columns} items-center gap-2 py-[3px] text-xs hover:bg-muted/40`}
        >
          <span className="truncate text-muted-foreground" title={keyToLabel(key)}>
            {keyToLabel(key)}
          </span>
          <span className="min-w-0">
            <span className="group-hover:hidden">
              <ValueText attribute={attribute} />
            </span>
            <span className="hidden group-hover:block">
              <ValueControl attributeKey={key} attribute={attribute} />
            </span>
          </span>
          {badges(attribute.src)}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------------------- C — folded */

/**
 * A hundred claims open as nine lines. Each group is one line that carries its count and the
 * numbers of the documents behind it, so the analyst chooses what to read before he reads it.
 * The first group opens by itself, so the screen is never empty.
 *
 * The bet: on a node of this size the question is rarely "what does it hold", it is "what does
 * it hold about the owner", and a fold answers that in one movement.
 */
export function FoldedClaims({ entity, badges, compact }: ClaimsViewProps) {
  const groups = groupClaims(entity);
  const [open, setOpen] = useState<string | null>(groups[0]?.label ?? null);

  return (
    <div>
      {groups.map((group) => {
        const sources = [...new Set(group.entries.flatMap(([, attribute]) => attribute.src))];
        const isOpen = open === group.label;

        return (
          <section key={group.label}>
            <button
              type="button"
              onClick={() => {
                setOpen(isOpen ? null : group.label);
              }}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 border-b border-border py-1 text-left text-xs hover:bg-muted/40"
            >
              <span className="w-3 shrink-0 font-mono text-muted-foreground">
                {isOpen ? '–' : '+'}
              </span>
              <span className="flex-1 truncate font-medium">{group.label}</span>
              <span className="font-mono text-muted-foreground">{group.entries.length}</span>
              {badges(sources)}
            </button>

            {isOpen && (
              <div className="pb-2 pl-5">
                {group.entries.map(([key, attribute]) => (
                  <ClaimRow
                    key={key}
                    attributeKey={key}
                    attribute={attribute}
                    badges={badges(attribute.src)}
                    compact={compact}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
