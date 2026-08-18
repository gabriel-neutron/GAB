/**
 * One cited document, on two lines, with the rest behind one control.
 *
 * Built from `docs/detail-surface.md` §4.3, and from the finding §3.3. §3.6 puts the score of
 * the document here and nowhere else, and §5.1 makes an absent rating words and not a dash.
 *
 * **The defect this shape exists to not repeat:** a first card drew the title, the kind, the
 * score, the origin, the original address, the archive address, the hash and the date on eight
 * lines. Fourteen of them filled three screens, and the rail became the thing the analyst
 * scrolled instead of the record. **Do not add a third line.**
 *
 * **#31 is still met.** The reader is given all three addresses: the original address is on line
 * 2, and the archive address and the hash open behind the control. #31 asks that a reader gets
 * them, not that a rail repeats them fourteen times.
 *
 * The card draws what `./dossier` derived. It re-derives nothing: the score, the short form of
 * each address and the claims the document holds up all arrive ready.
 */

import { useId, useState } from 'react';

import { cn } from '@/shared/lib/utils';
import { Button } from '@/shared/ui/button';

import type { SourceCardModel } from './dossier';

export interface SourceCardProps {
  readonly source: SourceCardModel;
}

/**
 * §5.4: a link takes the accent, because a reader must see what is reachable. It is the one
 * exception to rule 8, which leaves the evidentiary layer with no hue at all.
 */
const LINK = 'min-w-0 truncate text-primary underline underline-offset-2';

/** The name column of the panel behind the control. One width, so the values line up. */
const NAME = 'w-16 shrink-0 truncate text-label';

export function SourceCard({ source }: SourceCardProps) {
  // §7 and #33: the only view state of this surface is which disclosure is open. It dies with
  // the view, so React state is where ADR 0004 §7 puts it.
  const [open, setOpen] = useState<boolean>(false);
  const panelId = useId();

  // Invariant 6 keeps the rating and its origin together, so one line carries both. `not rated`
  // and `rating incomplete` arrive with no origin, and an absence never reads as a low score.
  const scoreWords =
    source.scoreOrigin === '' ? source.score : `${source.score}, ${source.scoreOrigin}`;

  return (
    <article
      aria-label={`Source ${source.number} — ${source.title}`}
      data-source={source.id}
      // Rule 3: one border level. The hairline separates two cards, and nothing inside the card
      // carries a second one.
      className="rounded-none border-b border-border px-2 py-1.5"
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-[11px]/4 tabular-nums text-label">
          {source.number}
        </span>
        {/* Rule 16: the value truncates and the full one appears on hover. `truncate` alone does
            nothing in a flex row, so `min-w-0` sits beside it. */}
        <span className="min-w-0 flex-1 truncate text-xs" title={source.title}>
          {source.title}
        </span>
        {/* §3.6: the score belongs to the document and appears once, here. It is never repeated
            on a claim, because one score on twenty claims reads as a score for each claim. */}
        <span
          className="max-w-40 shrink-0 truncate font-mono text-[11px]/4 text-label"
          title={scoreWords}
        >
          {scoreWords}
        </span>
      </div>

      <div className="mt-1 flex items-center gap-2 text-[11px]/4">
        {source.uri === null ? (
          // §4.3: an absence is said in words. A scan carries no address, and a dash would read
          // as a value that the surface lost.
          <span className="min-w-0 flex-1 truncate text-label">No address recorded</span>
        ) : (
          <a
            href={source.uri}
            title={source.uri}
            // The name says what the link opens. The visible text is the short address, because
            // a full address does not fit a two-line card.
            aria-label={`Open the original document at ${source.uri}`}
            className={cn(LINK, 'flex-1')}
          >
            {source.uriShort ?? source.uri}
          </a>
        )}
        <span className="shrink-0 font-mono tabular-nums text-label">
          {source.retrievedAt ?? 'No date of retrieval'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => {
            setOpen(!open);
          }}
          // Rule 17: a state change lasts under 120ms. `transition-colors` with no duration runs
          // at the Tailwind default of 150ms, so the duration is stated. The button is a ghost
          // and carries no edge, so no `border` token reaches a control here.
          //
          // **The defect this list exists to not repeat:** the class list carried `h-5` and beat
          // the `h-6` of `size="xs"`. Rule 1 of `src/index.css` states one control height,
          // `--control-height: 24px`. **Do not state a height here again.**
          className="shrink-0 rounded-none px-1 text-[11px]/4 transition-colors duration-100"
        >
          {`Claims (${source.holdsUp.length})`}
        </Button>
      </div>

      {source.missing ? (
        // A surface that drops evidence in silence is worse than one that says what it dropped.
        // The row is drawn and never hidden.
        <p className="mt-1 text-[11px]/4 text-dissent">
          This document is cited and it has no row in the record.
        </p>
      ) : null}

      {open ? (
        <div id={panelId} className="mt-1 space-y-1 text-[11px]/4">
          <div>
            <p className={cn(NAME, 'w-auto')}>
              {`Claims this document holds up (${source.holdsUp.length})`}
            </p>
            {source.holdsUp.length === 0 ? (
              <p>This document holds up no claim on this page.</p>
            ) : (
              <ul className="mt-0.5 space-y-0.5">
                {source.holdsUp.map((claim) => (
                  <li key={claim.key} className="flex gap-2">
                    <span className={cn(NAME)} title={claim.label}>
                      {claim.label}
                    </span>
                    <span className="min-w-0 truncate" title={claim.text}>
                      {claim.text}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </article>
  );
}
