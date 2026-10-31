import { cn } from '@/shared/lib/utils';
import { fightUi } from '../../content';
import { chainCount, flowLinks, routeCounts, totalsAt } from './chain-data';
import { ChainTotals } from './chain-panels';
import { layoutFlow } from './layouts';

const copy = fightUi.chain;

// A documented step is in ink, a lead in grey, a step with no source found is hollow.
const cellOf = (state: string) =>
  state.startsWith('documented')
    ? 'bg-foreground'
    : state === 'lead'
      ? 'bg-label/60'
      : 'border border-label';

const ACCENT = new Set(['China', 'Hong Kong']);
// The flow is drawn in units: 1000 wide, HEIGHT tall, so that the figure fits in one view.
const HEIGHT = 540;
const BAR = 8;
const flow = layoutFlow(flowLinks, HEIGHT, 10);
const xOf = (column: number) => (column * (1000 - BAR)) / (flow.columns - 1);

/** The routes of figure 11 as one ranked flow, from the country of the component manufacturer to
 * the end use. The bars and the bands share one scale; the labels of the last column use the
 * gutter at the right. */
function Flow() {
  return (
    <div className="hidden md:block">
      <div className="relative mr-[11rem] h-10 font-mono text-caption uppercase text-label">
        {copy.flowColumns.map((name, index) => (
          <p
            key={name}
            className="absolute top-0 w-max max-w-[9rem] lg:max-w-[14rem]"
            style={{ left: `${String((xOf(index) / 1000) * 100)}%` }}
          >
            {name}
          </p>
        ))}
      </div>
      <div className="relative mt-4 mr-[11rem] mb-6" style={{ height: HEIGHT }}>
        <svg
          aria-hidden="true"
          viewBox={`0 0 1000 ${String(HEIGHT)}`}
          preserveAspectRatio="none"
          className="absolute inset-0 size-full"
        >
          {flow.bands.map(({ link, y0, y1, h }) => {
            const a = xOf(link.column) + BAR;
            const b = xOf(link.column + 1);
            const mid = (a + b) / 2;
            return (
              <path
                key={`${String(link.column)}-${link.from}-${link.to}`}
                d={`M${String(a)},${String(y0)}C${String(mid)},${String(y0)} ${String(mid)},${String(y1)} ${String(b)},${String(y1)}V${String(y1 + h)}C${String(mid)},${String(y1 + h)} ${String(mid)},${String(y0 + h)} ${String(a)},${String(y0 + h)}Z`}
                className={
                  ACCENT.has(link.from) || ACCENT.has(link.to)
                    ? 'fill-signal/35'
                    : 'fill-foreground/12'
                }
              />
            );
          })}
        </svg>
        {flow.nodes.map((node) => {
          const last = node.column === flow.columns - 1;
          return (
            <div
              key={`${String(node.column)}-${node.name}`}
              className="absolute"
              style={{
                left: `${String((xOf(node.column) / 1000) * 100)}%`,
                top: node.y,
                height: Math.max(node.h, 1),
                width: `${String((BAR / 1000) * 100)}%`,
              }}
            >
              <span
                className={cn(
                  'block size-full',
                  ACCENT.has(node.name) ? 'bg-signal' : 'bg-foreground',
                )}
              />
              <span
                className={cn(
                  'absolute top-1/2 left-[calc(100%+0.25rem)] w-max -translate-y-1/2 border-l-2 bg-background px-1.5 py-px text-[13px]/4',
                  ACCENT.has(node.name) ? 'border-signal' : 'border-foreground',
                  last ? 'max-w-[10rem]' : 'max-w-[10rem] lg:max-w-[16rem]',
                  ACCENT.has(node.name) && 'text-signal',
                )}
              >
                {node.name}{' '}
                <span className="font-mono text-data tabular-nums">{chainCount(node.value)}</span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-4 max-w-[64ch] text-body-sm text-muted-foreground">{copy.flowText}</p>
    </div>
  );
}

/** Figure 11: one ranked flow of the chains (on a phone, four lists on one scale), and the steps
 * of the routes by state, one cell for each step. */
export function RoutesFigure() {
  const states = Object.entries(routeCounts.hops);
  const lists = [totalsAt(0, 'from'), totalsAt(0), totalsAt(1), totalsAt(2)];
  const max = Math.max(...lists.flat().map((total) => total.chains));
  return (
    <div className="grid gap-12">
      <Flow />
      {/* On a phone: the four columns as lists on one scale, linked by their step numbers. */}
      <ol className="grid md:hidden">
        <li className="pb-6 font-mono text-caption text-muted-foreground">{copy.flowSmall}</li>
        {lists.map((totals, index) => (
          <li key={copy.flowColumns[index]} className="grid grid-cols-[2.25rem_minmax(0,1fr)]">
            <div aria-hidden="true" className="flex flex-col items-center">
              <span className="font-mono text-data text-signal tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </span>
              {index < lists.length - 1 ? <span className="mt-1 w-0.5 flex-1 bg-signal" /> : null}
            </div>
            <div className="border-t-2 border-signal pt-2 pb-8">
              <ChainTotals title={copy.flowColumns[index] ?? ''} totals={totals} max={max} />
            </div>
          </li>
        ))}
      </ol>
      <table className="sr-only">
        <caption>{copy.flowText}</caption>
        <thead>
          <tr>
            <th scope="col">{copy.step}</th>
            {/* shortcut: From and To are not in content.ts, which is in another pull request. */}
            <th scope="col">From</th>
            <th scope="col">To</th>
            <th scope="col">{copy.unitChains}</th>
          </tr>
        </thead>
        <tbody>
          {flowLinks.map((link) => (
            <tr key={`${String(link.column)}-${link.from}-${link.to}`}>
              <td>
                {copy.flowColumns[link.column]} to {copy.flowColumns[link.column + 1]}
              </td>
              <td>{link.from}</td>
              <td>{link.to}</td>
              <td>{chainCount(link.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <p className="font-mono text-caption uppercase text-label">{copy.stepsByState}</p>
        <div aria-hidden="true" className="mt-3 grid grid-cols-33 gap-px md:grid-cols-66">
          {states.flatMap(([state, count]) =>
            Array.from({ length: count }, (_unused, cell) => (
              <span
                key={`${state}-${String(cell)}`}
                className={cn('aspect-square', cellOf(state))}
              />
            )),
          )}
        </div>
        <ul className="mt-3 grid gap-x-8 gap-y-1 font-mono text-data text-muted-foreground md:grid-cols-2">
          {states.map(([state, count]) => (
            <li key={state} className="flex items-start gap-2">
              <span aria-hidden="true" className={cn('mt-0.5 size-2.5 shrink-0', cellOf(state))} />
              <span className="break-words">
                {state} <span className="text-foreground tabular-nums">{count}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
