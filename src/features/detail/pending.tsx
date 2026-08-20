/**
 * The candidate layer, outside the record.
 *
 * `./dossier` finds each
 * pending proposal that names this entity and writes its words, so this file holds exactly one
 * `.map` and calls no `toFixed`.
 *
 * **This section is never mixed into the record.** It draws itself as one region with a name of
 * its own; the page puts it below the record. A candidate is not evidence, and a reader
 * must never take one for a promoted claim.
 *
 * **It must not act.** No accept, no reject, no control that decides anything: that is the
 * review queue, and what happens to an undecided proposal is open. The mark to the source is
 * the only control here.
 *
 * **One vocabulary must serve two surfaces, and that question is open.** This surface should use
 * the words the graph uses, and how a pending proposal appears in the graph is not settled. The
 * word below is `candidate`, because the theme token of `src/index.css` already fixes it here.
 * It is a guess, it lives at one point of one file, and it is reported under ASK.
 */

import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

import type { PendingLine, SourceRef } from './dossier';

export interface PendingProps {
  /** Already found, already worded, already formatted. `./dossier` decides all three. */
  readonly proposals: readonly PendingLine[];
  /** The mark to the source. The caller owns which source is active and what a click does. */
  readonly mark: (sources: readonly SourceRef[]) => ReactNode;
}

/**
 * PU1 asks for labelling that no control can hide, and a hue is hidden from a reader who cannot
 * see a colour. The word and the token therefore go together, and the word is never dropped.
 */
const CANDIDATE = 'candidate';

export function Pending({ proposals, mark }: PendingProps) {
  return (
    <section aria-label="Pending proposals">
      <h2 className="flex items-baseline gap-2 pb-1">
        <span className="text-[11px]/4 tracking-[0.06em] text-label uppercase">
          Pending proposals
        </span>
        <span className="font-mono text-[11px]/4 tabular-nums text-label">{proposals.length}</span>
      </h2>
      {proposals.length === 0 ? (
        // The count and the reason in one sentence. No icon, and no friendly line.
        <p className="text-xs text-label">
          0 pending proposals. No proposal of the record names this entity, and none was dropped.
        </p>
      ) : (
        <ul>
          {proposals.map((proposal) => (
            // Rule 3: one border level. A dashed hairline against the solid one of an
            // evidentiary row, so a candidate row never reads as a promoted row.
            <li
              key={proposal.id}
              data-proposal={proposal.id}
              className="flex items-center gap-2 border-b border-dashed border-border py-1"
            >
              {/* The word is on the row, in text, and the token paints it. The
                  word holds on both grounds and for a reader who sees no colour. */}
              <span className="shrink-0 text-[11px]/4 text-candidate">{CANDIDATE}</span>
              {/* Rule 16: a value truncates and the full one appears on hover. `truncate` alone
                  does nothing in a flex row, so `min-w-0` sits beside it. The summary already
                  carries the sentence where the proposal is undecided. */}
              <span className="min-w-0 flex-1 truncate text-xs" title={proposal.summary}>
                {proposal.summary}
              </span>
              {/* A disagreement between agents is what sends a proposal to the review queue, so
                  it takes the one hue that means "look at this", and it is words as well. */}
              <span
                className={cn(
                  'shrink-0 text-[11px]/4',
                  proposal.dissent ? 'text-dissent' : 'text-label',
                )}
              >
                {proposal.dissent ? 'dissent' : 'no dissent'}
              </span>
              {/* Rule 13: a figure is monospace and tabular. `./dossier` formatted it. There is
                  no column header on this row, so the name of the figure reaches a reader as
                  hidden words: a bare number says nothing about what it measures. */}
              <span className="sr-only">confidence</span>
              <span className="shrink-0 font-mono text-[11px]/4 tabular-nums text-label">
                {proposal.confidence}
              </span>
              {/* The mark is last on the row, and it is inside nothing that can hide it. It is
                  also the only control: every action on a proposal is decided elsewhere. */}
              {mark(proposal.sources)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
