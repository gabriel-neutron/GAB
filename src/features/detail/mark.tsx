/**
 * The mark that carries the provenance of one claim, one relation or one proposal.
 *
 * Built from `docs/detail-surface.md` §5.1, §3.6, §4.4 and §4.5.
 *
 * **Two exports, and they are one job.** §5.1 gives every claim a mark to its source on **both**
 * surfaces, and §4.4 and §4.5 then give each surface a different control for it. `SourceMark` is
 * the page control and `SourceCount` is the sidebar control. They share the empty-source case,
 * the shape of the control and the obligation that produced both, so they stay in one file.
 *
 * **Neither has an entry of its own in §4, and that is stated under ASK.** The obligation is
 * specified across §5.1 — a claim never appears without a mark to its source, and no control
 * hides the mark — §3.6, which makes the page badge a number alone and never the score, and §4.4
 * and §4.5, which say what a mark does on each surface. The operator specified the sidebar
 * control on 13 August 2026, on #68. The operator owns whether §4 gains an entry for either.
 *
 * **Why the two controls differ.** A number is a pointer to a card. The page carries the rail, so
 * the reader can follow the pointer. The sidebar carries no rail (§4.5), so a number there points
 * at nothing that is on the screen. The sidebar therefore states **how many** documents hold the
 * line up, and opens all of them in one popover.
 *
 * **§5.1 is met by the count.** The count is the mark: it is on the screen, no control hides it,
 * and it says exactly how much evidence stands behind the line. What opens on demand is the
 * *document*, never the fact that one exists.
 *
 * §3.6 is a real tension and this file does not resolve it: PU1 asks for the origin **and** the
 * score of every candidate claim to be visible, and a number is a pointer to both. **#12 owns
 * it.** The score reaches a reader through the accessible name, and never as printed text on a
 * claim, because one score repeated on twenty claims is the presentation S1 calls false.
 */

import { cn } from '@/shared/lib/utils';
import type { DocId } from '@/shared/fixtures/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';

import type { SourceCardModel, SourceRef } from './dossier';
import { SourceCard } from './source-card';

export interface SourceMarkProps {
  readonly sources: readonly SourceRef[];
  readonly activeSource: DocId | null;
  readonly onSelectSource: (docId: DocId) => void;
}

export interface SourceCountProps {
  readonly sources: readonly SourceRef[];
  /**
   * Every card of the dossier, in the order §4.4 numbered them. `SourceRef.number` is the 1-based
   * position in this array, so a mark reaches its card by index and no `.find` runs inside a
   * component.
   */
  readonly cards: readonly SourceCardModel[];
  /**
   * The entity whose full page the way out opens, or `null` where there is no page to open.
   *
   * **`null` is the relation view of #89**, which draws the sources of a relation and has no full
   * page of its own. The popover then carries the card and no way out. **It must not point at an
   * entity at one end of the relation**: that page carries the sources of *that entity*, so the
   * link would open a rail where the card of this document need not exist, and a reader would
   * take the absence for a lost source.
   */
  readonly entityId: string | null;
}

/**
 * Rule 8: the evidentiary layer carries no hue. The mark is grey at rest, and the active one is
 * marked by its edge and its fill.
 *
 * A mark that acts is a real `<button>`, so it reaches the keyboard, the focus ring and the
 * reader with no extra code. The ring is the one the kit writes.
 *
 * **Three defects this list exists to not repeat.** The edge was `border-border`, which is the
 * token that separates two surfaces: it measures about 1.3:1 light and 1.5:1 dark, and this is
 * the edge of a control. `border-input` is the token measured for a control edge, at 3.4:1 and
 * 3.2:1. **Keep `input` on a control edge.** And `transition-colors` carried no duration, so it
 * ran at the Tailwind default of 150ms, above the 120ms of rule 17. The duration is stated. And
 * the height was `h-5`: rule 1 of `src/index.css` states one control height,
 * `--control-height: 24px`, which is `h-6`, and a mark sits on a line of controls of that height.
 * **Keep it at 24 px.**
 */
const MARK =
  'inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-none border border-input px-1 font-mono text-[11px]/4 text-label transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * §5.1 and invariant 1: a claim never appears without a mark to its source, and M8 gives every
 * attribute at least one source.
 *
 * **The defect this exists to not repeat:** an empty list rendered an empty element, so a claim
 * with no provenance drew nothing and nothing said so. A surface that drops evidence in silence
 * is worse than one that says how much it dropped. The words below report a fault in the data,
 * and they are words and never a dash and never a blank.
 */
const NO_SOURCE = 'No source recorded: invariant 1 asks each claim for at least one.';

function NoSource() {
  return <span className="shrink-0 text-[11px]/4 text-dissent">{NO_SOURCE}</span>;
}

/**
 * §4.5: the popover carries one way out — the full page, in a new tab, opened at that source.
 *
 * **No `?surface=` reaches this address.** §6 calls that parameter scaffolding of the prototype
 * and the rebuild leaves it behind. `?src=` is not scaffolding: §6 keeps it, because it is how
 * the sidebar hands a document to a new tab.
 */
const WAY_OUT = 'Open the full page at this source, in a new tab';

/** The row of marks. */
const ROW = 'inline-flex shrink-0 items-center gap-1';

/**
 * The page control — §4.4 and §3.6. One numbered badge for each document, and a click moves the
 * rail to that card.
 */
export function SourceMark({ sources, activeSource, onSelectSource }: SourceMarkProps) {
  if (sources.length === 0) return <NoSource />;

  return (
    <span className={ROW}>
      {sources.map((source) => (
        <button
          key={source.id}
          type="button"
          // §3.6: the visible text is the number alone. The title and the score of the document
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
 * The sidebar control — §4.5 and #68. One control for the whole line: it states how many
 * documents hold that line up, and it opens every one of them in one popover.
 *
 * **The defect this exists to not repeat:** the sidebar drew one numbered badge for each
 * document, in a row that could not shrink. At 24 rem a line of four badges took the room the
 * value needed, and the number pointed at a rail that this surface does not carry.
 */
export function SourceCount({ sources, cards, entityId }: SourceCountProps) {
  if (sources.length === 0) return <NoSource />;

  const one = sources.length === 1;

  return (
    // Radix owns the open state of a popover. There is no `useState` and no `useEffect` in this
    // file, and none is needed.
    <Popover>
      <PopoverTrigger
        // The count is the visible text. The name says what the count counts and what a click
        // does, because a bare number says neither to a reader.
        //
        // It carries **no** `aria-pressed`: nothing is active in a sidebar, because there is no
        // rail for a mark to move.
        aria-label={
          one ? '1 source document. Open it.' : `${sources.length} source documents. Open them.`
        }
        className={cn(MARK)}
      >
        {sources.length}
      </PopoverTrigger>
      {/* The kit writes `w-72 rounded-lg p-4` at its own scale. The correction is made here, at
          the call site, because a vendored file is closed. **The shadow stays**: a popover is a
          true overlay, and rule 6 permits a shadow on one.

          The panel holds its own scroll. A line with eight documents opens eight cards, and a
          popover that grows past the window puts the way out of the last card off the screen. */}
      <PopoverContent className="max-h-96 w-80 overflow-y-auto overscroll-contain p-0" align="end">
        {sources.map((source) => {
          // The index alignment the props type states. `number` is 1-based, so the card of
          // source 7 is `cards[6]`. A `.find` inside a component is how a claim loses its
          // provenance, and none runs here.
          const card = cards[source.number - 1];

          return (
            <div key={source.id}>
              {card === undefined ? (
                // A surface that drops evidence in silence is worse than one that says what it
                // dropped. This states a fault in the derivation, and never a blank.
                <p className="p-2 text-[11px]/4 text-dissent">
                  {`Source ${source.number} carries no card in this dossier.`}
                </p>
              ) : (
                // **The same card the rail draws**, so the two surfaces can never disagree about
                // a document. §4.3 owns its shape and this file states none of it.
                <SourceCard source={card} />
              )}
              {/* **No entity, no way out** — #89. A relation has no full page, and a link to
                  the page of an endpoint would open a rail that need not hold this card. The
                  popover then states the document and stops there. */}
              {entityId === null ? null : (
                <a
                  // **Both values are percent-encoded.** `spec.md` §3 settles no identifier
                  // schema, so this surface assumes nothing about the characters an identifier
                  // carries. An unencoded `&`, `#`, `?` or space cuts the address short or adds a
                  // parameter, and it does both in silence. **Keep the encoding.**
                  href={`/entity/${encodeURIComponent(entityId)}?src=${encodeURIComponent(source.id)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  // §5.4: a link takes the accent, because a reader must see what is reachable.
                  //
                  // §4.5 gives the popover one way out **per document**: "opened at that source"
                  // names one source, so each card carries its own. With one document the popover
                  // reads exactly as it did before #68.
                  className="block truncate px-2 py-1.5 text-[11px]/4 text-primary underline underline-offset-2"
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
