/**
 * The mark that carries the provenance of one claim, one relation or one proposal.
 *
 * Built from `docs/detail-surface.md` §5.1, §3.6, §4.4 and §4.5.
 *
 * **This component has no entry of its own in §4, and that is stated here under ASK.** It is
 * specified across §5.1 — a claim never appears without a mark to its source, and no control
 * hides the mark — §3.6, which makes the badge a number alone and never the score, and §4.4 and
 * §4.5, which say what a mark does on each surface. It appears at four callers: the record, the
 * relations, the pending list and the sidebar. The complexity therefore reappears at three
 * callers and earns the file. The operator owns whether §4 gains an entry for it.
 *
 * **Two surfaces, and one behaviour for each.** §4.4 moves the rail on a click, on the page.
 * §4.5 opens the source in a popover, in the sidebar, and that popover carries one way out.
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

/**
 * The two surfaces of §4.5 and UC5, as a closed union on one discriminant.
 *
 * **`surface` is a domain word and not an appearance.** UC5 names the two places an analyst
 * reads one entity: the full page, where the provenance is audited, and the narrow sidebar
 * beside the map or the graph. §4.4 and §4.5 then give each place a different behaviour for a
 * mark — the page moves its rail, and the sidebar has no rail and opens a popover. A reviewer
 * will ask, because the skill refuses an appearance prop such as `variant` or `isCompact`:
 * this prop selects a **use case**, and the two branches carry different data for that reason.
 *
 * The union makes the illegal state impossible to build. A page mark cannot carry the cards of
 * the whole dossier, and a sidebar mark cannot carry an active source, because a sidebar holds
 * nothing that could be active.
 */
export type SourceMarkProps =
  | {
      readonly surface: 'page';
      readonly sources: readonly SourceRef[];
      readonly activeSource: DocId | null;
      readonly onSelectSource: (docId: DocId) => void;
    }
  | {
      readonly surface: 'sidebar';
      readonly sources: readonly SourceRef[];
      /**
       * Every card of the dossier, in the order §4.4 numbered them. `SourceRef.number` is the
       * 1-based position in this array, so a mark reaches its card by index and no `.find`
       * runs inside a component.
       */
      readonly cards: readonly SourceCardModel[];
      readonly entityId: string;
    };

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
 * 3.2:1. **Do not put `border` back on a control.** And `transition-colors` carried no duration,
 * so it ran at the Tailwind default of 150ms, above the 120ms of rule 17. The duration is
 * stated. And the height was `h-5`: rule 1 of `src/index.css` states one control height,
 * `--control-height: 24px`, which is `h-6`, and a mark sits on a line of controls of that
 * height. **Do not make it 20 px again.**
 */
const MARK =
  'inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-none border px-1 font-mono text-[11px]/4 transition-colors duration-100 outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/**
 * §5.1 and invariant 1: a claim never appears without a mark to its source, and M8 gives every
 * attribute at least one source.
 *
 * **The defect this exists to not repeat:** an empty list rendered an empty element, so a claim
 * with no provenance drew nothing and nothing said so. A surface that drops evidence in silence
 * is worse than one that says how much it dropped. The words below report a fault in the data,
 * and they are never a dash and never a blank.
 */
const NO_SOURCE = 'No source recorded: invariant 1 asks each claim for at least one.';

/** The row of marks. One rule for both surfaces, so a mark sits the same way in a claim cell. */
const ROW = 'inline-flex shrink-0 items-center gap-1';

/**
 * §4.5: the popover carries one way out — the full page, in a new tab, opened at that source.
 *
 * **No `?surface=` reaches this address.** §6 calls that parameter scaffolding of the prototype
 * and the rebuild leaves it behind. `?src=` is not scaffolding: §6 keeps it, because it is how
 * the sidebar hands a document to a new tab.
 */
const WAY_OUT = 'Open the full page at this source, in a new tab';

export function SourceMark(props: SourceMarkProps) {
  const { sources } = props;

  if (sources.length === 0) {
    return <span className="shrink-0 text-[11px]/4 text-dissent">{NO_SOURCE}</span>;
  }

  if (props.surface === 'sidebar') {
    const { cards, entityId } = props;

    return (
      <span className={ROW}>
        {sources.map((source) => {
          // The index alignment the props type states. `number` is 1-based, so the card of
          // source 7 is `cards[6]`. A `.find` inside a component is how a claim loses its
          // provenance, and none runs here.
          const card = cards[source.number - 1];

          return (
            // Radix owns the open state of a popover. There is no `useState` and no
            // `useEffect` in this file, and none is needed.
            <Popover key={source.id}>
              <PopoverTrigger
                // §4.5: the same badge. It carries **no** `aria-pressed`, because nothing is
                // active in a sidebar: there is no rail for a mark to move.
                aria-label={source.name}
                className={cn(MARK, 'border-input text-label')}
              >
                {source.number}
              </PopoverTrigger>
              {/* The kit writes `w-72 rounded-lg p-4` at the shadcn scale. The correction is
                  made here, at the call site, because a vendored file is closed. **The shadow
                  stays**: a popover is a true overlay, and rule 6 permits a shadow on one. */}
              <PopoverContent className="w-80 rounded-none p-0" align="end">
                {card === undefined ? (
                  // A surface that drops evidence in silence is worse than one that says what
                  // it dropped. This states a fault in the derivation, and never a blank.
                  <p className="p-2 text-[11px]/4 text-dissent">
                    {`Source ${source.number} carries no card in this dossier.`}
                  </p>
                ) : (
                  // **The same card the rail draws**, so the two surfaces can never disagree
                  // about a document. §4.3 owns its shape and this file states none of it.
                  <SourceCard source={card} />
                )}
                <a
                  // **Both values are percent-encoded.** `spec.md` §3 settles no identifier
                  // schema, so this surface assumes nothing about the characters an identifier
                  // carries. An unencoded `&`, `#`, `?` or space cuts the address short or adds
                  // a parameter, and it does both in silence. **Do not remove the encoding.**
                  href={`/entity/${encodeURIComponent(entityId)}?src=${encodeURIComponent(source.id)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  // §5.4: a link takes the accent, because a reader must see what is reachable.
                  className="block truncate px-2 py-1.5 text-[11px]/4 text-primary underline underline-offset-2"
                >
                  {WAY_OUT}
                </a>
              </PopoverContent>
            </Popover>
          );
        })}
      </span>
    );
  }

  const { activeSource, onSelectSource } = props;

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
            activeSource === source.id
              ? 'border-foreground bg-muted text-foreground'
              : 'border-input text-label',
          )}
        >
          {source.number}
        </button>
      ))}
    </span>
  );
}
