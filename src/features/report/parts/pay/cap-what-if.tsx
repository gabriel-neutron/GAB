import { useId, useState } from 'react';
import { useContent } from '../../use-content';
import { PriceChart } from './pay-figures';
import { lineGap, monthName, payData } from './pay-data';

const f4 = payData.f4;
const prices = f4.urals.flatMap((point) => (point === null ? [] : [point.y]));
// The slider runs over the range of Urals; it starts on the first real cap.
const MIN = Math.floor(Math.min(...prices));
const MAX = Math.ceil(Math.max(...prices));
export const WHAT_IF_START = Math.round(f4.caps[0]?.value ?? MIN);

/** The slider of the what-if line, and for each month Urals minus the line: the count of the
 * months where Urals is above the line, their names, and the months with no value. */
export function WhatIfControls({
  line,
  onLine,
}: {
  readonly line: number;
  readonly onLine: (line: number) => void;
}) {
  const { payUi } = useContent();
  const words = payUi.f4.whatIf;
  const id = useId();
  const result = lineGap(f4.urals, line);
  const value = words.line.replace('{v}', String(line));
  return (
    <div>
      <p className="font-mono text-report-label uppercase text-label">{words.title}</p>
      <label htmlFor={id} className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-report-small">{words.slider}</span>
        <input
          id={id}
          type="range"
          min={MIN}
          max={MAX}
          step={1}
          value={line}
          aria-valuetext={value}
          onChange={(event) => {
            onLine(Number(event.target.value));
          }}
          className="h-11 min-w-0 grow basis-48 accent-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
        />
        <output htmlFor={id} className="font-mono tabular-nums">
          {value}
        </output>
      </label>
      <div className="mt-4 text-report-small">
        {/* Only the count is live: the list of months is too long to hear at each key press. */}
        <p aria-live="polite">
          {result.above.length === 0
            ? words.none
            : words.above
                .replace('{n}', String(result.above.length))
                .replace('{k}', String(result.known))}
        </p>
        {result.above.length === 0 ? null : (
          <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-report-label/5 text-muted-foreground">
            {result.above.map((x) => (
              <span key={x}>{monthName(x)}</span>
            ))}
          </p>
        )}
      </div>
      <p className="mt-1 text-report-small text-muted-foreground">
        {words.missing.replace('{n}', String(result.months.length - result.known))}
      </p>
    </div>
  );
}

/** The label of the what-if line in the chart, for example "what-if 60 $". */
export const whatIfLabel = (words: { readonly line: string }, line: number) =>
  words.line.replace('{v}', String(line));

/** The values of figure 4 at the what-if line, as a table in a disclosure. */
export function WhatIfTable({ line }: { readonly line: number }) {
  const { payUi } = useContent();
  const words = payUi.f4.whatIf;
  const result = lineGap(f4.urals, line);
  return (
    <details className="mt-4">
      <summary className="flex min-h-11 cursor-pointer items-center text-report-small">
        {words.table}
      </summary>
      <table className="mt-2 font-mono text-report-label tabular-nums">
        <caption className="sr-only">
          {words.table}, {whatIfLabel(words, line)}
        </caption>
        <thead>
          <tr>
            <th scope="col" className="pr-6 text-left font-normal text-label">
              {words.month}
            </th>
            <th scope="col" className="pr-6 text-right font-normal text-label">
              {words.urals}
            </th>
            <th scope="col" className="text-right font-normal text-label">
              {words.gap}
            </th>
          </tr>
        </thead>
        <tbody>
          {result.months.map(({ x, gap }) => (
            <tr key={x}>
              <th scope="row" className="pr-6 text-left font-normal">
                {monthName(x)}
              </th>
              <td className="pr-6 text-right">{f4.urals[x]?.y.toFixed(2) ?? ''}</td>
              <td className="text-right">{gap === null ? '' : gap.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

/** Figure 4 in its final state with the what-if line, for a reader with reduced motion: the
 * slider, the one chart and its table. */
export function CapWhatIf() {
  const { payUi } = useContent();
  const [line, setLine] = useState(WHAT_IF_START);
  return (
    <div>
      <WhatIfControls line={line} onLine={setLine} />
      <PriceChart step={3} whatIf={{ value: line, label: whatIfLabel(payUi.f4.whatIf, line) }} />
      <WhatIfTable line={line} />
    </div>
  );
}
