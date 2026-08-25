/**
 * The score reaches a reader through the accessible name, and never as printed text on a claim:
 * one score repeated on twenty claims is the presentation S1 calls false. */

import { cn } from '@/shared/lib/utils';
import type { DocId } from '@/shared/fixtures/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

import { entityHref } from './address';
import type { SourceCardModel, SourceRef } from './dossier';
import { SourceCard } from './source-card';

export interface SourceMarkProps {
  readonly sources: readonly SourceRef[];
  readonly activeSource: DocId | null;
  readonly onSelectSource: (docId: DocId) => void;
}

export interface SourceCountProps {
  readonly sources: readonly SourceRef[];
  /** `SourceRef.number` is the 1-based position in this array, so a mark reaches its card by
   * index and no `.find` runs in a component. */
  readonly cards: readonly SourceCardModel[];
  /** `null` is the relation view, which has no full page. The way out must not point at an entity
   * at one end of the relation: that page carries the sources of that entity, so the link would
   * open a rail where the card of this document need not exist. */
  readonly entityId: string | null;
}

/** `border-input` measures 3.4:1 light and 3.2:1 dark on a control edge; `border-border` gives
 * 1.3:1 and 1.5:1. The duration is stated: the Tailwind default of 150ms is above the 120ms the
 * theme allows. `h-6` is the 24px of `--control-height`. */
const MARK =
  'inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-none border border-input px-1 font-mono text-small/4 text-label transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * Invariant 1: a claim never appears without a mark to its source, and M8 gives every attribute
 * at least one source. The words report a fault in the data, never a dash and never a blank. */
const NO_SOURCE = 'No source recorded: invariant 1 asks each claim for at least one.';

function NoSource() {
  return <span className="shrink-0 text-small/4 text-dissent">{NO_SOURCE}</span>;
}

const WAY_OUT = 'Open the full page at this source, in a new tab';

const ROW = 'inline-flex shrink-0 items-center gap-1';

export function SourceMark({ sources, activeSource, onSelectSource }: SourceMarkProps) {
  if (sources.length === 0) return <NoSource />;

  return (
    <span className={ROW}>
      {sources.map((source) => (
        <button
          key={source.id}
          type="button"
          // The visible text is the number alone. The title and the score of the document
          // reach a reader through the accessible name.
          aria-label={source.name}
          aria-pressed={activeSource === source.id}
          onClick={() => {
            onSelectSource(source.id);
          }}
          className={cn(
            MARK,
            activeSource === source.id && 'border-foreground bg-muted text-foreground',
          )}
        >
          {source.number}
        </button>
      ))}
    </span>
  );
}

/**
 * The sidebar states how many documents hold a line up, and never one badge for each: at 24 rem
 * a row of four badges takes the room the value needs, and this surface carries no rail. */
export function SourceCount({ sources, cards, entityId }: SourceCountProps) {
  if (sources.length === 0) return <NoSource />;

  const one = sources.length === 1;

  return (
    // Radix owns the open state of a popover.
    <Popover>
      <PopoverTrigger
        // No `aria-pressed`: nothing is active in a sidebar, because there is no rail for a mark
        // to move.
        aria-label={
          one ? '1 source document. Open it.' : `${sources.length} source documents. Open them.`
        }
        className={cn(MARK)}
      >
        {sources.length}
      </PopoverTrigger>
      {/* The kit writes `w-72 rounded-lg p-4` at its own scale. The correction is made here, at
          the call site, because a vendored file is closed. The panel holds its own scroll: a
          popover that grows past the window puts the way out of its last card off the screen. */}
      <PopoverContent className="max-h-96 w-80 overflow-y-auto overscroll-contain p-0" align="end">
        {sources.map((source) => {
          // `number` is 1-based, so the card of source 7 is `cards[6]`.
          const card = cards[source.number - 1];

          return (
            <div key={source.id}>
              {card === undefined ? (
                // A surface that drops evidence in silence is worse than one that says what it
                // dropped. This states a fault in the derivation, and never a blank.
                <p className="p-2 text-small/4 text-dissent">
                  {`Source ${source.number} carries no card in this dossier.`}
                </p>
              ) : (
                <SourceCard source={card} />
              )}
              {/* **No entity, no way out.** A relation has no full page, and a link to
                  the page of an endpoint would open a rail that need not hold this card. The
                  popover then states the document and stops there. */}
              {entityId === null ? null : (
                <a
                  href={entityHref(entityId, source.id)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block truncate px-2 py-1.5 text-small/4 text-primary underline underline-offset-2"
                >
                  {WAY_OUT}
                </a>
              )}
            </div>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
