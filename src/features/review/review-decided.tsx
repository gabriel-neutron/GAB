/**
 * **PROTOTYPE — throwaway.** The record of what was decided, on its own page.
 *
 * `spec.md` §5: a rejected proposal is never deleted, because it is the record of what was set
 * aside. That makes it evidence, and it does not make it work. It is therefore off the review
 * surface and on a page that is rarely opened.
 *
 * **Nothing here is described as automatic.** Whether a proposal can ever be applied without a
 * human is #42, and it is open, so this page shows only what carries a decision in the data.
 */

import { decidedRows, short } from './review-model';
import { ChangeMark, KIND_COLOR } from './review-parts';

export function ReviewDecided() {
  const rows = decidedRows();

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-semibold">Decided</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Kept, never deleted. The record of what entered the evidentiary layer and what was set
        aside.
      </p>

      <ul className="mt-6">
        {rows.map((row) => (
          <li
            key={row.proposal.id}
            className="flex items-baseline gap-3 border-l-2 py-2 pl-3"
            style={{ borderLeftColor: KIND_COLOR[row.kind] }}
          >
            <span className="w-28 shrink-0">
              <ChangeMark kind={row.kind} />
            </span>
            <span className="flex-1">
              <span className="block text-sm">{row.label}</span>
              <span className="text-xs text-muted-foreground">
                {row.proposal.status} by {row.proposal.decidedBy ?? 'nobody named'} on{' '}
                {row.proposal.decidedAt?.slice(0, 10) ?? 'no date'} · {row.authorLabel}
              </span>
            </span>
            <span className="shrink-0 font-mono text-xs text-muted-foreground">
              {short(row.proposal.id)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-xs text-muted-foreground">
        A row here carries no reason for the decision. The model records{' '}
        <span className="font-mono">decided_at</span> and{' '}
        <span className="font-mono">decided_by</span>, and never why — so a rejection cannot be read
        back, only counted.
      </p>
    </div>
  );
}
