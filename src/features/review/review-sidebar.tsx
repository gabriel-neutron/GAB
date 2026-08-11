/**
 * **PROTOTYPE — throwaway.** The narrow queue, for later composition beside the map and the
 * graph. It is the second review surface of P3, the first being the marker on the graph.
 *
 * **It triages and it does not decide.** A row says what is being changed, what kind of change
 * it is, how many are waiting on it, and how sound the weakest of them is. There is no accept
 * and no reject: at this width neither the cited text nor the row as it stands can be shown, and
 * `prd.md` §3 says that a painful W5–W6 makes the system produce nothing.
 *
 * **One undivided list**, ordered by a control the host can change. No group headings, no
 * operational parameter.
 *
 * The route composes it. A feature never imports another feature — ADR 0004 §5.
 */

import {
  pendingSubjects,
  SORT_KEYS,
  SORT_LABEL,
  sortSubjects,
  subjectConfidence,
  type SortKey,
  type Subject,
} from './prototype-model';
import { ChangeMark, ConfidenceBadge, KIND_COLOR } from './prototype-parts';

export interface ReviewSidebarProps {
  /** The subject being examined, when the host knows it. Identity lives in the URL — #33. */
  readonly selectedId?: string | undefined;
  /** The host decides where a click goes. Beside the map it navigates to `/review`. */
  readonly onSelect?: ((subjectId: string) => void) | undefined;
  readonly sort?: SortKey | undefined;
  readonly onSort?: ((next: SortKey) => void) | undefined;
}

export function ReviewSidebar({
  selectedId,
  onSelect,
  sort = 'confidence',
  onSort,
}: ReviewSidebarProps) {
  const subjects = sortSubjects(pendingSubjects(), sort);
  const changes = subjects.reduce((sum, subject) => sum + subject.changes.length, 0);

  return (
    <aside
      className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-background"
      aria-label="Review queue"
    >
      <header className="px-3 py-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold">Review</h2>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {changes} on {subjects.length}
          </span>
        </div>
        {onSort !== undefined && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs">
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
        )}
      </header>

      <ul className="min-h-0 flex-1 overflow-y-auto pb-3">
        {subjects.map((subject) => (
          <QueueRow
            key={subject.id}
            subject={subject}
            selected={subject.id === selectedId}
            onSelect={onSelect}
          />
        ))}
        {subjects.length === 0 && (
          <li className="px-3 text-sm text-muted-foreground">Nothing waits.</li>
        )}
      </ul>
    </aside>
  );
}

function QueueRow({
  subject,
  selected,
  onSelect,
}: {
  subject: Subject;
  selected: boolean;
  onSelect: ((subjectId: string) => void) | undefined;
}) {
  const kind = subject.changes[0]?.kind ?? 'edit';
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => {
          onSelect?.(subject.id);
        }}
        className={`w-full border-l-2 py-1.5 pr-3 pl-2.5 text-left ${
          selected ? 'bg-muted' : 'hover:bg-muted/50'
        }`}
        style={{ borderLeftColor: KIND_COLOR[kind] }}
      >
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm">{subject.label}</span>
          <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
            {subject.changes.length}
          </span>
        </span>
        <span className="mt-1 flex items-center gap-2">
          <ChangeMark kind={kind} />
          <ConfidenceBadge confidence={subjectConfidence(subject)} />
        </span>
      </button>
    </li>
  );
}
