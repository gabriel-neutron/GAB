import { Columns2 } from 'lucide-react';
import { useState } from 'react';

import { cn } from '@/shared/lib/utils';

import { ChangeCard } from './change-card';
import { ContestedGlyph } from './contested-mark';
import { Decide } from './decide';
import { NodePane } from './node-pane';
import {
  changeLines,
  focusOf,
  railRows,
  sortSubjects,
  subjectOf,
  verdictOf,
  type SortKey,
  type Subject,
  type Verdict,
  type Verdicts,
} from './queue';
import { SubjectRail } from './subject-rail';

/** Every act of this surface, as a closed set. A caller cannot build one this page cannot make,
 * and the page states what happened and never what a store should become. */
export type ReviewAct =
  | { readonly kind: 'select'; readonly subjectId: string }
  | { readonly kind: 'sort'; readonly sort: SortKey }
  | {
      readonly kind: 'decide';
      readonly changeId: string;
      readonly verdict: Verdict;
      readonly reason: string;
    }
  | { readonly kind: 'undo'; readonly changeId: string };

/** Everything that waits for a decision, and what this pass decided of it. Nothing here writes
 * a verdict to the record. */
export interface ReviewQueue {
  readonly subjects: readonly Subject[];
  readonly verdicts: Verdicts;
}

/** What is under examination. The address holds the subject and the workspace holds the order,
 * and this page reads both once. */
export interface Examination {
  readonly subjectId: string | null;
  readonly sort: SortKey;
}

export interface ReviewPageProps {
  readonly queue: ReviewQueue;
  readonly examination: Examination;
  readonly onAct: (act: ReviewAct) => void;
}

/** The rail holds a whole name at 18 rem; at 14 rem three of five labels truncated. */
const SHELL = 'grid h-full grid-cols-[18rem_20rem_minmax(0,1fr)] gap-2 p-2';

const PANE = 'flex min-h-0 flex-col gap-2 border-l border-border pl-2';

const TOGGLE = cn(
  'inline-flex h-6 shrink-0 items-center gap-1 border border-input px-2 text-xs',
  'transition-colors duration-100 outline-none focus-visible:border-ring',
  'focus-visible:ring-3 focus-visible:ring-ring/50',
);

export function ReviewPage({ queue, examination, onAct }: ReviewPageProps) {
  const { subjects, verdicts } = queue;
  const { subjectId, sort } = examination;
  // Which act the hand is on, and whether two acts stand open. Both die with the view: the
  // record has no home for either, and this page invents none.
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [together, setTogether] = useState(false);

  const ordered = sortSubjects(subjects, sort);
  const rows = railRows(ordered, verdicts);
  const subject = subjectOf(ordered, subjectId);
  const { current, beside } = focusOf(subject, focusedId);
  const lines = subject === null ? [] : changeLines(subject, verdicts);
  const open = together && beside.length > 0;

  // An empty queue is said once, in the pane that states the count. Two more panes that each
  // said it were the same sentence three times, over two empty columns.
  if (subject === null || current === null) {
    return (
      <div className="flex h-full flex-col p-2">
        <SubjectRail
          queue={{ rows, currentId: null, sort }}
          onSelect={(id) => {
            onAct({ kind: 'select', subjectId: id });
          }}
          onSort={(next) => {
            onAct({ kind: 'sort', sort: next });
          }}
        />
      </div>
    );
  }

  return (
    <div className={SHELL}>
      <SubjectRail
        queue={{ rows, currentId: subject.id, sort }}
        onSelect={(id) => {
          setFocusedId(null);
          onAct({ kind: 'select', subjectId: id });
        }}
        onSort={(next) => {
          onAct({ kind: 'sort', sort: next });
        }}
      />

      <div className={PANE}>
        <NodePane
          subject={subject}
          lines={lines}
          currentChangeId={current.id}
          onFocus={setFocusedId}
        />
      </div>

      <div className={PANE}>
        {beside.length === 0 ? null : (
          <div className="flex h-6 shrink-0 items-center gap-1.5">
            <ContestedGlyph />
            <span
              title="Another act of this row reads a key that the open act reads"
              className="shrink-0 font-mono text-small/4 tabular-nums text-dissent"
            >
              {beside.length}
            </span>
            <span className="sr-only">
              {beside.length === 1
                ? 'One other act names a key this one names.'
                : 'Other acts name a key this one names.'}
            </span>
            <button
              type="button"
              aria-pressed={together}
              onClick={() => {
                setTogether(!together);
              }}
              className={cn(TOGGLE, 'ml-auto', together ? 'bg-muted' : null)}
            >
              <Columns2 size={14} aria-hidden="true" />
              {together ? 'Read one at a time' : 'Read them together'}
            </button>
          </div>
        )}

        {/* Two acts that contradict each other are read beside each other. Below the width of
            two cards the pair scrolls, because a card that is cut hides evidence in silence. */}
        <div
          className={cn(
            'flex min-h-0 shrink gap-2 overflow-x-auto overscroll-contain',
            open ? null : 'max-w-[44rem]',
          )}
        >
          <ChangeCard change={current} current={true} />
          {open
            ? beside.map((change) => <ChangeCard key={change.id} change={change} current={false} />)
            : null}
        </div>

        {/* The controls stay at the foot, whatever stands above them. That is why this layout
            was chosen: the hand goes to one place for every act. */}
        <footer className="mt-auto shrink-0 border-t border-border pt-2">
          <Decide
            key={current.id}
            decision={verdictOf(verdicts, current.id)}
            onDecide={(verdict, reason) => {
              onAct({ kind: 'decide', changeId: current.id, verdict, reason });
            }}
            onUndo={() => {
              onAct({ kind: 'undo', changeId: current.id });
            }}
          />
        </footer>
      </div>
    </div>
  );
}
