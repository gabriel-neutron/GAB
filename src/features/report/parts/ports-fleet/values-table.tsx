import { useContent } from '../../use-content';

/** The values of a chart, for a reader who cannot see the marks. */
export function ValuesTable({
  head,
  rows,
}: {
  readonly head: readonly string[];
  readonly rows: readonly (readonly string[])[];
}) {
  const { portsFleetUi } = useContent();
  return (
    <details className="mt-3 border-t border-border pt-1">
      <summary className="flex min-h-11 cursor-pointer items-center font-mono text-report-label text-label">
        {portsFleetUi.flows.table}
      </summary>
      <div className="max-h-80 overflow-auto">
        <table className="w-full text-left font-mono text-report-label tabular-nums">
          <thead className="text-label">
            <tr>
              {head.map((cell, index) => (
                <th key={`${String(index)}-${cell}`} className="py-1 pr-3 font-normal">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row[0]} className="border-t border-divider">
                {row.map((cell, index) =>
                  index === 0 ? (
                    <th key="name" scope="row" className="py-1 pr-3 font-normal whitespace-nowrap">
                      {cell}
                    </th>
                  ) : (
                    <td key={`${String(index)}-${cell}`} className="py-1 pr-3">
                      {cell}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
