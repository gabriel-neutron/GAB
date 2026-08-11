/**
 * **PROTOTYPE — throwaway. Layout A — Focus.**
 *
 * One proposal fills the screen. A rail on the left says what is next and why. The keyboard
 * carries the whole pass: `J` and `K` move, `A` accepts, `R` rejects, `D` defers.
 *
 * The claim it tests: W6 is an act of judgement, so the screen holds one judgement, and the
 * evidence for it needs no second surface.
 *
 * **Only what waits for a decision is here.** A decided proposal is never deleted — `spec.md`
 * §5 — but it is the record and not the work, so it lives on `/review/decided`.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Clock, X } from 'lucide-react';

import { Button } from '@/shared/ui/button';

import {
  BUCKET_TITLE,
  groupRows,
  type DecisionMap,
  type LocalVerdict,
  type ReviewRow,
} from './review-model';
import {
  ChangeMark,
  ChangeTable,
  ConfidenceBar,
  DissentNote,
  GapLine,
  KIND_ACCENT,
  MetaLine,
  Quote,
  ReasonBadge,
  SourceLine,
  UnroutedNote,
} from './review-parts';

export interface LayoutProps {
  readonly rows: readonly ReviewRow[];
  readonly decisions: DecisionMap;
  readonly onDecide: (proposalId: string, verdict: LocalVerdict, reason: string) => void;
  readonly selectedId: string | null;
  readonly onSelect: (proposalId: string) => void;
}

export function VariantFocus({ rows, decisions, onDecide, selectedId, onSelect }: LayoutProps) {
  const groups = groupRows(rows);
  const flat = groups.flatMap(([, list]) => list);
  const current = flat.find((r) => r.proposal.id === selectedId) ?? flat[0] ?? null;
  const [deferring, setDeferring] = useState(false);
  const [reason, setReason] = useState('');
  const reasonRef = useRef<HTMLTextAreaElement | null>(null);
  const held = Object.values(decisions).filter((d) => d.verdict === 'deferred').length;

  const move = (step: number): void => {
    if (current === null) return;
    const at = flat.findIndex((r) => r.proposal.id === current.proposal.id);
    const next = flat[Math.min(flat.length - 1, Math.max(0, at + step))];
    if (next !== undefined) onSelect(next.proposal.id);
  };

  const decide = (verdict: LocalVerdict): void => {
    if (current === null) return;
    if (verdict === 'deferred') {
      setDeferring(true);
      window.setTimeout(() => reasonRef.current?.focus(), 0);
      return;
    }
    onDecide(current.proposal.id, verdict, '');
    move(1);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target;
      // The keys are inert while a reason is being typed.
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      switch (event.key) {
        case 'j':
          move(1);
          break;
        case 'k':
          move(-1);
          break;
        case 'a':
          decide('accepted');
          break;
        case 'r':
          decide('rejected');
          break;
        case 'd':
          decide('deferred');
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  });

  return (
    // The extra room at the foot is for the prototype switcher, which is not part of the design.
    <div className="grid h-[calc(100svh-9rem)] grid-cols-[17rem_1fr] gap-6">
      <nav className="flex min-h-0 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {groups.map(([bucket, list]) => (
            <section key={bucket} className="mb-4">
              <h2 className="mb-1 text-xs font-medium text-muted-foreground">
                {BUCKET_TITLE[bucket]}
              </h2>
              <ul>
                {list.map((row) => (
                  <li key={row.proposal.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(row.proposal.id);
                      }}
                      aria-current={row.proposal.id === current?.proposal.id ? 'true' : undefined}
                      className={`w-full border-l-2 py-1.5 pl-2.5 text-left ${KIND_ACCENT[row.kind]} ${
                        row.proposal.id === current?.proposal.id ? 'bg-muted' : 'hover:bg-muted/50'
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm">{row.title}</span>
                        {decisions[row.proposal.id] !== undefined && (
                          <span className="shrink-0 text-xs text-muted-foreground">·</span>
                        )}
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <ChangeMark kind={row.kind} />
                        <ConfidenceBar confidence={row.proposal.confidence} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {flat.length === 0 && <p className="text-sm text-muted-foreground">Nothing waits.</p>}
        </div>
        {held > 0 && (
          <GapLine>
            {held} held. Neither the URL nor the workspace has a shelf for a reason, and `held` is
            no status — #33.
          </GapLine>
        )}
      </nav>

      {current === null ? null : (
        // A measure, not the width of the window. The evidence and the change must be read
        // together, and at 1600px two stretched columns are two separate screens.
        <div
          className={`flex min-h-0 w-full max-w-5xl flex-col border-l-2 pl-6 ${KIND_ACCENT[current.kind]}`}
        >
          <header>
            <div className="flex items-center gap-3">
              <ChangeMark kind={current.kind} />
              <ReasonBadge row={current} />
              <ConfidenceBar confidence={current.proposal.confidence} wide />
            </div>
            <h1 className="mt-1.5 text-xl font-semibold">{current.target.headline}</h1>
          </header>

          <div className="mt-6 grid min-h-0 flex-1 grid-cols-2 gap-8 overflow-y-auto pr-2">
            <section className="space-y-3">
              {current.bucket === 'unrouted' && <UnroutedNote />}
              <ChangeTable changes={current.target.changes} />
              {current.target.changes.length === 0 && current.kind !== 'new-link' && (
                <p className="text-sm text-muted-foreground">No attribute changes.</p>
              )}
              {current.target.gaps.map((gap) => (
                <GapLine key={gap}>{gap}</GapLine>
              ))}
            </section>

            <section className="space-y-3">
              <Quote spans={current.spans} />
              <DissentNote row={current} />
              <ul className="space-y-1">
                {current.sources.map((source) => (
                  <SourceLine key={source.id} source={source} />
                ))}
              </ul>
              <MetaLine row={current} />
            </section>
          </div>

          <footer className="mt-4">
            {deferring ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground" htmlFor="gab-defer">
                    Why not yet?
                  </label>
                  <textarea
                    id="gab-defer"
                    ref={reasonRef}
                    value={reason}
                    onChange={(event) => {
                      setReason(event.target.value);
                    }}
                    rows={1}
                    className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                  />
                </div>
                <Button
                  onClick={() => {
                    onDecide(current.proposal.id, 'deferred', reason);
                    setReason('');
                    setDeferring(false);
                    move(1);
                  }}
                >
                  Hold
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDeferring(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    decide('deferred');
                  }}
                >
                  <Clock /> Defer <Kbd>D</Kbd>
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    decide('rejected');
                  }}
                >
                  <X /> Reject <Kbd>R</Kbd>
                </Button>
                <Button
                  onClick={() => {
                    decide('accepted');
                  }}
                >
                  <Check /> Promote <Kbd>A</Kbd>
                </Button>
              </div>
            )}
          </footer>
        </div>
      )}
    </div>
  );
}

function Kbd({ children }: { children: string }) {
  return <span className="ml-1 font-mono text-[0.65rem] opacity-60">{children}</span>;
}
