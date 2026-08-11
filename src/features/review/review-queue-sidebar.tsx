/**
 * **PROTOTYPE — throwaway.** The narrow queue, for later composition beside the map and the
 * graph. It is the second review surface of P3, the first being the marker on the graph.
 *
 * **It triages and it does not decide.** A row says what the change is, what it is to, and why
 * it is in review. There is no accept and no reject: at this width neither the cited text nor
 * the target as it stands can be shown, and `prd.md` §3 says that a painful W5–W6 makes the
 * system produce nothing. The decision goes to the full page.
 *
 * **It holds no operational parameter.** The threshold is not set here, and it is not shown.
 *
 * The route composes it. A feature never imports another feature — ADR 0004 §5.
 */

import { BUCKET_TITLE, groupRows, pendingRows, type ReviewRow } from './review-model';
import { ChangeMark, ConfidenceBar, KIND_ACCENT, ReasonBadge } from './review-parts';

export interface ReviewQueueSidebarProps {
  /** The proposal being examined, when the host knows it. Identity lives in the URL — #33. */
  readonly selectedId?: string | undefined;
  /** The host decides where a click goes. Beside the map it navigates to `/review`. */
  readonly onSelect?: ((proposalId: string) => void) | undefined;
}

export function ReviewQueueSidebar({ selectedId, onSelect }: ReviewQueueSidebarProps) {
  const groups = groupRows(pendingRows());
  const waiting = groups.reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <aside
      className="flex h-full w-64 shrink-0 flex-col border-r border-border bg-background"
      aria-label="Review queue"
    >
      <header className="flex items-baseline justify-between px-3 py-2.5">
        <h2 className="text-sm font-semibold">Review</h2>
        <span className="text-xs text-muted-foreground">{waiting}</span>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        {groups.map(([bucket, list]) => (
          <section key={bucket} className="mb-3">
            <h3 className="px-3 pb-1 text-xs text-muted-foreground">{BUCKET_TITLE[bucket]}</h3>
            <ul>
              {list.map((row) => (
                <QueueRow
                  key={row.proposal.id}
                  row={row}
                  selected={row.proposal.id === selectedId}
                  onSelect={onSelect}
                />
              ))}
            </ul>
          </section>
        ))}
        {waiting === 0 && <p className="px-3 text-sm text-muted-foreground">Nothing waits.</p>}
      </div>
    </aside>
  );
}

function QueueRow({
  row,
  selected,
  onSelect,
}: {
  row: ReviewRow;
  selected: boolean;
  onSelect: ((proposalId: string) => void) | undefined;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={selected ? 'true' : undefined}
        onClick={() => {
          onSelect?.(row.proposal.id);
        }}
        className={`w-full border-l-2 py-1.5 pr-3 pl-2.5 text-left ${KIND_ACCENT[row.kind]} ${
          selected ? 'bg-muted' : 'hover:bg-muted/50'
        }`}
      >
        <span className="block truncate text-sm">{row.title}</span>
        <span className="mt-1 flex items-center gap-2">
          <ChangeMark kind={row.kind} />
          <ConfidenceBar confidence={row.proposal.confidence} />
        </span>
        {row.bucket !== 'below' && (
          <span className="mt-1 block">
            <ReasonBadge row={row} />
          </span>
        )}
      </button>
    </li>
  );
}
