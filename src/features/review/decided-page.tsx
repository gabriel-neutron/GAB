import type { DecidedRow } from './decided';
import { VerdictMark } from './verdict-mark';

export interface DecidedPageProps {
  readonly rows: readonly DecidedRow[];
}

const HEAD = 'h-6 px-1.5 text-left align-bottom font-normal text-small/4 tracking-caps uppercase';

const CELL = 'px-1.5 py-1 align-top';

// A decided act is frozen by the record, a hold never reaches it, and a verdict carries no
// reason. The analyst must read each of the three here, because an absent row reads as a lost one.
export function DecidedPage({ rows }: DecidedPageProps) {
  return (
    <section
      aria-label="What the record decided"
      className="flex h-full min-h-0 flex-col gap-2 p-2"
    >
      <div className="max-w-[60rem] shrink-0 space-y-1 text-xs text-label">
        <p>
          Each act the record promoted, the latest decision first. A promoted act is frozen, and no
          door opens it again. A rejected act is not public, so this page does not list it.
        </p>
        <p>
          A hold is not listed, because the record holds no hold. The record keeps no reason for a
          promotion.
        </p>
        <p>
          The last column is the name the write service signs a verdict with. It does not prove that
          a person decided.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs text-label">The record holds no decided act.</p>
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
                  Keys
                </th>
                <th scope="col" className={HEAD}>
                  Proposed by
                </th>
                <th scope="col" className={HEAD}>
                  Signed as
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} data-decided={row.id} className="border-t border-border">
                  <td className={`${CELL} font-mono whitespace-nowrap tabular-nums`}>
                    <time dateTime={row.decidedAt}>{row.when}</time>
                  </td>
                  <td className={CELL}>
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      <VerdictMark verdict={row.verdict} words={row.verdictWords} />
                      {row.verdictWords}
                    </span>
                  </td>
                  <td className={`${CELL} whitespace-nowrap`}>{row.actWords}</td>
                  <td className={CELL}>{row.subject}</td>
                  <td className={`${CELL} font-mono`}>{row.keys}</td>
                  <td className={`${CELL} text-label`}>{row.author}</td>
                  <td className={`${CELL} text-label`}>{row.signedAs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
