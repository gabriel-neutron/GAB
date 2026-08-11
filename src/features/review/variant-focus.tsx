/**
 * **PROTOTYPE — throwaway. Layout A — the full page, where a decision is made.**
 *
 * **The page is one subject at a time, and a subject carries every pending change against it.**
 * An agent produces several proposals against one node; reviewing them one screen at a time asks
 * the analyst to hold the node in their head across six screens, and it hides the case that
 * matters — two changes to the same node that contradict each other.
 *
 * **Each change is still decided on its own.** P1 makes the promotion the pivotal act, so there
 * is no "accept all". The keyboard runs the pass: `J` and `K` step through the changes across
 * every subject, `A` promotes, `R` rejects, `D` defers.
 *
 * Only what waits is here. What was decided is on `/review/decided`.
 */

import { useEffect, useState } from 'react';
import { Check, Clock, X } from 'lucide-react';

import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';

import {
  formatValue,
  short,
  SORT_KEYS,
  SORT_LABEL,
  sortSubjects,
  subjectConfidence,
  type Change,
  type DecisionMap,
  type LocalVerdict,
  type SortKey,
  type Subject,
} from './review-model';
import {
  ChangeFlags,
  ChangeMark,
  ChangeTable,
  ConfidenceBadge,
  DissentNote,
  GapLine,
  KIND_COLOR,
  Quote,
  SourceLine,
  UnroutedNote,
} from './review-parts';

export interface LayoutProps {
  readonly subjects: readonly Subject[];
  readonly sort: SortKey;
  readonly onSort: (next: SortKey) => void;
  readonly decisions: DecisionMap;
  readonly onDecide: (proposalId: string, verdict: LocalVerdict, reason: string) => void;
  readonly selectedId: string | null;
  readonly onSelect: (subjectId: string) => void;
}

export function VariantFocus({
  subjects,
  sort,
  onSort,
  decisions,
  onDecide,
  selectedId,
  onSelect,
}: LayoutProps) {
  const ordered = sortSubjects(subjects, sort);
  const current = ordered.find((s) => s.id === selectedId) ?? ordered[0] ?? null;
  // Which change the keyboard acts on. It is not identity, so it is not in the address — #33.
  const [focusId, setFocusId] = useState<string | null>(null);
  const [deferring, setDeferring] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  const flat = ordered.flatMap((subject) => subject.changes.map((change) => ({ subject, change })));
  const at = flat.findIndex((entry) => entry.change.proposal.id === focusId);
  const focused = at === -1 ? (current?.changes[0] ?? null) : (flat[at]?.change ?? null);

  const move = (step: number): void => {
    const from = at === -1 ? flat.findIndex((e) => e.subject.id === current?.id) : at;
    const next = flat[Math.min(flat.length - 1, Math.max(0, from + step))];
    if (next === undefined) return;
    setFocusId(next.change.proposal.id);
    if (next.subject.id !== current?.id) onSelect(next.subject.id);
  };

  const decide = (change: Change | null, verdict: LocalVerdict): void => {
    if (change === null) return;
    if (verdict === 'deferred') {
      setDeferring(change.proposal.id);
      return;
    }
    onDecide(change.proposal.id, verdict, '');
    move(1);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      const target = event.target;
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
          decide(focused, 'accepted');
          break;
        case 'r':
          decide(focused, 'rejected');
          break;
        case 'd':
          decide(focused, 'deferred');
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
    <div className="grid h-[calc(100svh-9rem)] grid-cols-[17rem_1fr] gap-6">
      <nav className="flex min-h-0 flex-col">
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
          <span className="mr-1 text-muted-foreground">sort</span>
          {SORT_KEYS.map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === sort}
              onClick={() => {
                onSort(key);
              }}
              className={`px-1.5 py-0.5 ${
                key === sort ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              {SORT_LABEL[key]}
            </button>
          ))}
        </div>

        {/* One undivided list. The reason a change is in review is a mark on the change, not a
            heading over a group — the operator asked for that on 11 August 2026. */}
        <ul className="min-h-0 flex-1 overflow-y-auto">
          {ordered.map((subject) => {
            const settled = subject.changes.filter(
              (c) => decisions[c.proposal.id] !== undefined,
            ).length;
            return (
              <li key={subject.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(subject.id);
                    setFocusId(subject.changes[0]?.proposal.id ?? null);
                  }}
                  aria-current={subject.id === current?.id ? 'true' : undefined}
                  className={`w-full border-l-2 py-1.5 pr-2 pl-2.5 text-left ${
                    subject.id === current?.id ? 'bg-muted' : 'hover:bg-muted/50'
                  }`}
                  style={{ borderLeftColor: KIND_COLOR[subject.changes[0]?.kind ?? 'edit'] }}
                >
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm">{subject.label}</span>
                    <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                      {settled > 0 && `${settled}/`}
                      {subject.changes.length}
                    </span>
                  </span>
                  <span className="mt-1 flex items-center gap-2">
                    <ChangeMark kind={subject.changes[0]?.kind ?? 'edit'} />
                    <ConfidenceBadge confidence={subjectConfidence(subject)} />
                  </span>
                </button>
              </li>
            );
          })}
          {ordered.length === 0 && (
            <li className="text-sm text-muted-foreground">Nothing waits.</li>
          )}
        </ul>
      </nav>

      {current === null ? null : (
        <div className="flex min-h-0 w-full max-w-4xl flex-col">
          <SubjectHeader subject={current} />

          <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-2">
            {current.changes.map((change) => (
              <ChangeCard
                key={change.proposal.id}
                change={change}
                focused={change.proposal.id === focused?.proposal.id}
                decision={decisions[change.proposal.id]?.verdict ?? null}
                deferring={deferring === change.proposal.id}
                reason={reason}
                onReason={setReason}
                onFocus={() => {
                  setFocusId(change.proposal.id);
                }}
                onDecide={(verdict) => {
                  if (verdict === 'deferred') {
                    onDecide(change.proposal.id, 'deferred', reason);
                    setReason('');
                    setDeferring(null);
                  } else {
                    decide(change, verdict);
                  }
                }}
                onDefer={() => {
                  setDeferring(change.proposal.id);
                }}
                onCancelDefer={() => {
                  setDeferring(null);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * The head of the page. It answers one question — **what am I looking at** — and nothing else.
 * The name, what kind of thing it is, and the row as it stands today.
 */
function SubjectHeader({ subject }: { subject: Subject }) {
  // A link stands as much as a node does, and a deletion is judged on what it removes. Reading
  // only `entity` here left a proposed deletion with nothing to weigh it against.
  const standing = subject.entity ?? subject.relation;
  return (
    <header>
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-semibold">{subject.label}</h1>
        {subject.type !== null && <Badge variant="secondary">{subject.type}</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {subject.kind === 'new-node' && 'This node does not exist yet · '}
        {subject.kind === 'link' && subject.relation === null && 'This link does not exist yet · '}
        {standing !== null && `${short(standing.id)} · `}
        {subject.changes.length} change{subject.changes.length === 1 ? '' : 's'} waiting
      </p>

      {standing !== null && Object.keys(standing.attrs).length > 0 && (
        <div className="mt-3">
          <h2 className="text-xs font-medium text-muted-foreground">As it stands</h2>
          <dl className="mt-1 grid grid-cols-[10rem_1fr] gap-x-4 text-sm">
            {Object.entries(standing.attrs).map(([key, attr]) => (
              <div key={key} className="contents">
                <dt className="font-mono text-xs text-muted-foreground">{key}</dt>
                <dd>
                  {formatValue(attr.v)}
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {attr.src.join(' ')}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {/* M6 reserves an interval for an identity or ownership link. A deletion that removes a
          dated claim is not the same act as one that removes an undated one. */}
      {subject.relation !== null &&
        (subject.relation.validFrom !== null || subject.relation.validTo !== null) && (
          <p className="mt-1 text-xs text-muted-foreground">
            valid {subject.relation.validFrom ?? 'unknown'} to {subject.relation.validTo ?? 'now'}
          </p>
        )}
    </header>
  );
}

/** One pending change: what it does, on what evidence, and the two buttons that settle it. */
function ChangeCard({
  change,
  focused,
  decision,
  deferring,
  reason,
  onReason,
  onFocus,
  onDecide,
  onDefer,
  onCancelDefer,
}: {
  change: Change;
  focused: boolean;
  decision: LocalVerdict | null;
  deferring: boolean;
  reason: string;
  onReason: (next: string) => void;
  onFocus: () => void;
  onDecide: (verdict: LocalVerdict) => void;
  onDefer: () => void;
  onCancelDefer: () => void;
}) {
  return (
    <section
      onFocus={onFocus}
      onClick={onFocus}
      className={`border-l-[3px] py-2 pr-2 pl-3 ${focused ? 'bg-muted/60' : ''} ${
        decision !== null ? 'opacity-50' : ''
      }`}
      style={{ borderLeftColor: KIND_COLOR[change.kind] }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <ChangeMark kind={change.kind} />
        <ConfidenceBadge confidence={change.proposal.confidence} />
        <ChangeFlags change={change} />
        <span className="ml-auto flex items-center gap-1">
          {decision === null ? (
            <>
              <Button variant="ghost" size="sm" onClick={onDefer}>
                <Clock /> Defer
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  onDecide('rejected');
                }}
              >
                <X /> Reject
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onDecide('accepted');
                }}
              >
                <Check /> Promote
              </Button>
            </>
          ) : (
            <Badge variant="outline">{decision}</Badge>
          )}
        </span>
      </div>

      <div className="mt-2 space-y-1.5">
        {change.summary !== '' && <p className="text-sm">{change.summary}</p>}
        <ChangeTable changes={change.changes} />
        <Quote spans={change.spans} />
        {change.sources.map((source) => (
          <SourceLine key={source.id} source={source} />
        ))}
        <DissentNote change={change} />
        {change.unrouted && <UnroutedNote />}
        {change.gaps.map((gap) => (
          <GapLine key={gap}>{gap}</GapLine>
        ))}
        <GapLine>
          {change.authorLabel} · {change.ageDays} days ago
        </GapLine>
      </div>

      {deferring && (
        <div className="mt-2 flex items-center gap-2">
          <input
            autoFocus
            value={reason}
            onChange={(event) => {
              onReason(event.target.value);
            }}
            placeholder="Why not yet?"
            className="h-8 flex-1 border border-border bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button
            size="sm"
            onClick={() => {
              onDecide('deferred');
            }}
          >
            Hold
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancelDefer}>
            Cancel
          </Button>
        </div>
      )}
    </section>
  );
}
