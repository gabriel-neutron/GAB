import { useId, useState } from 'react';
import { useContent } from '../../use-content';
import { PriceChart } from './pay-figures';
import { lineGap, payData } from './pay-data';

const f4 = payData.f4;
const prices = f4.urals.flatMap((point) => (point === null ? [] : [point.y]));
// The slider runs over the range of Urals; it starts on the first real cap.
const MIN = Math.floor(Math.min(...prices));
const MAX = Math.ceil(Math.max(...prices));
const START = f4.caps[0]?.value ?? MIN;
const monthName = (x: number) => new Date(Date.UTC(2022, 11 + x, 1)).toISOString().slice(0, 7);

/** Figure 4 in its final state with a what-if line that the reader moves. For each month it
 * shows Urals minus the line, and it names the months where Urals is above the line. */
export function CapWhatIf() {
  const { payUi } = useContent();
  const words = payUi.f4.whatIf;
  const [line, setLine] = useState(START);
  const id = useId();
  const result = lineGap(f4.urals, line);
  const value = words.line.replace('{v}', String(line));
  return (
    <div className="mt-10 border-t border-border pt-6">
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
            setLine(Number(event.target.value));
          }}
          className="h-11 min-w-0 grow basis-48 accent-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
        />
        <output htmlFor={id} className="font-mono tabular-nums">
          {value}
        </output>
      </label>
      <PriceChart step={3} whatIf={{ value: line, label: value }} />
      <div aria-live="polite" className="mt-4 text-report-small">
        <p>
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
      <details className="mt-4">
        <summary className="cursor-pointer text-report-small">{words.table}</summary>
        <table className="mt-2 font-mono text-report-label tabular-nums">
          <caption className="sr-only">{words.table}</caption>
          <thead>
            <tr>
              <th scope="col" className="pr-6 text-left font-normal text-label">
                {words.month}
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
                <td className="text-right">{gap === null ? '' : gap.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
