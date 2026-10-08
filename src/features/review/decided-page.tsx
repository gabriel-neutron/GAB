import { cn } from '@/shared/lib/utils';

import type { DecidedRow } from './decided';
import { VerdictMark } from './verdict-mark';

/** The decided acts that the page read so far, the count of the acts that it cannot read, the
 * sentence of a later page that failed, and whether a next page waits, or the sentence that says
 * why the page holds none. */
export type DecidedView =
  | {
      readonly state: 'held';
      readonly rows: readonly DecidedRow[];
      readonly unread: number;
      readonly why: string | null;
      readonly more: 'none' | 'ready' | 'reading';
    }
  | { readonly state: 'private'; readonly why: string };

export interface DecidedPageProps {
  readonly view: DecidedView;
  readonly onMore: () => void;
}

const HEAD = 'h-6 px-1.5 text-left align-bottom font-normal text-small/4 tracking-caps uppercase';

const CELL = 'px-1.5 py-1 align-top';

const CONTROL = cn(
  'h-6 border border-input px-2 text-xs outline-none focus-visible:border-ring',
  'focus-visible:ring-3 focus-visible:ring-ring/50 transition-colors duration-100 hover:bg-muted',
);

/** Each act that the operator decided, promoted or rejected, the latest decision first. A
 * rejection shows its reason and its note, which only the operator reads. */
export function DecidedPage({ view, onMore }: DecidedPageProps) {
  if (view.state === 'private') return <p className="p-3 text-xs text-label">{view.why}</p>;
  const { rows, unread, why, more } = view;
  return (
    <section aria-label="What was decided" className="flex h-full min-h-0 flex-col gap-2 p-2">
      <p className="max-w-[60rem] shrink-0 text-xs text-label">
        Each act that was promoted or rejected, by a rule or by the operator, the latest decision
        first. A decided act is frozen. The reason and the note of a rejection are private to the
        operator.
      </p>

      {unread === 0 ? null : (
        <p data-said="unread" className="shrink-0 text-xs text-destructive">
          {unread === 1 ? '1 decided act' : `${String(unread)} decided acts`} cannot be read by this
          page, and the table does not show {unread === 1 ? 'it' : 'them'}.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="text-xs text-label">No act was decided yet.</p>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto overscroll-contain">
          <table className="w-full border-collapse text-xs">
            <caption className="sr-only">Decided acts, the latest decision first</caption>
            <thead className="text-label">
              <tr>
                <th scope="col" className={HEAD}>
                  Decided
                </th>
                <th scope="col" className={HEAD}>
                  Verdict
                </th>
                <th scope="col" className={HEAD}>
                  Act
                </th>
                <th scope="col" className={HEAD}>
                  What it changes
                </th>
                <th scope="col" className={HEAD}>
                  Reason
                </th>
                <th scope="col" className={HEAD}>
                  Proposed by
                </th>
                <th scope="col" className={HEAD}>
                  Decided by
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-decided={row.id} className="border-t border-border">
                  <td className={cn(CELL, 'font-mono whitespace-nowrap tabular-nums')}>
                    <time dateTime={row.decidedAt}>{row.when}</time>
                  </td>
                  <td className={CELL}>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <VerdictMark verdict={row.verdict} words={row.verdictWords} />
                      {row.verdictWords}
                    </span>
                  </td>
                  <td className={cn(CELL, 'whitespace-nowrap')}>{row.actWords}</td>
                  <td className={cn(CELL, 'break-words')}>{row.subject}</td>
                  <td className={cn(CELL, 'break-words')}>{row.reason}</td>
                  <td className={cn(CELL, 'text-label')}>{row.author}</td>
                  <td className={cn(CELL, 'text-label')} title={`Signed as ${row.signedAs}`}>
                    {row.decidedHow}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {why === null ? null : <p className="p-2 text-xs text-destructive">{why}</p>}
          {more === 'none' ? null : (
            <div className="p-2">
              <button
                type="button"
                disabled={more === 'reading'}
                onClick={onMore}
                className={CONTROL}
              >
                {more === 'reading' ? 'Reading the next acts' : 'Read the next acts'}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
