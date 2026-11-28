import { Fragment } from 'react';
import { cn } from '@/shared/lib/utils';
import { reportGraph, type GraphNode } from '../../report-graph';
import { useContent, type ReportContent } from '../../use-content';
import { useReport } from '../../use-report';

// The layer of the report graph for each layer of the figure, in the same order in all locales.
const LAYER_KEYS = ['Pay', 'Finance', 'Fight'] as const;

// The arrows and the budget path show the argument of the report; no edge of the data backs them.

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Figure 2: the three layers in the order of the money, the two links between them, the budget
 * path, and the three conditions of an entity under watch as a list with hanging letters. The
 * figure gives no count: the squares of the page data were not the counts of the release. */
export function LayersFigure() {
  const { figureTexts, methodUi } = useContent();
  const { layers, arrows, conditions, budgetPath } = figureTexts.fig1;
  return (
    <div className="bg-[linear-gradient(var(--color-chart-grid)_1px,transparent_1px),linear-gradient(90deg,var(--color-chart-grid)_1px,transparent_1px)] bg-size-[2rem_2rem] py-6">
      <p className="bg-background font-mono text-report-label/4 text-label">
        {methodUi.layers.schematic}
      </p>
      <ol
        aria-label={methodUi.layers.label}
        className="mt-4 grid lg:grid-cols-[1fr_7rem_1fr_7rem_1fr] lg:grid-rows-[repeat(6,auto)]"
      >
        {layers.map((layer, index) => {
          const arrow = arrows[index];
          return (
            <Fragment key={layer.k}>
              {/* The rows of the three cards line up, so each "open" row is at the same height. */}
              <li className="min-w-0 border border-border bg-background p-4 md:p-6 lg:row-span-6 lg:grid lg:grid-rows-subgrid">
                <LayerColumn index={index} layer={layer} />
              </li>
              {arrow === undefined ? null : (
                <li className="flex items-center gap-3 py-3 pl-6 lg:row-span-6 lg:flex-col lg:justify-center lg:gap-2 lg:p-2 lg:text-center">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 48 12"
                    className="h-3 w-12 shrink-0 rotate-90 overflow-visible stroke-foreground lg:rotate-0"
                  >
                    <path d="M0 6 H46 M40 1 L46 6 L40 11" fill="none" strokeWidth="1.25" />
                  </svg>
                  <span className="font-mono text-report-label/4 text-label uppercase">
                    {arrow.lines.join(' ')}
                  </span>
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
      <p className="mt-4 flex items-start gap-3 border-t border-dashed border-foreground bg-background pt-3 font-mono text-report-label/4 text-label">
        <span aria-hidden="true" className="text-foreground">
          ↺
        </span>
        {budgetPath}
      </p>
      <section
        aria-label={methodUi.layers.conditions}
        className="mt-12 border-t border-foreground bg-background pt-3"
      >
        <h4 className="font-mono text-report-label uppercase text-label">
          {methodUi.layers.conditions}
        </h4>
        <ol className="mt-6 grid gap-8 lg:grid-cols-3">
          {conditions.map((one) => (
            <li
              key={one.letter}
              className="grid grid-cols-[3.5rem_minmax(0,1fr)] md:grid-cols-[6rem_minmax(0,1fr)]"
            >
              <span
                aria-hidden="true"
                className="font-mono text-report-number leading-[0.8] tracking-[-0.06em] text-foreground"
              >
                {one.letter}
              </span>
              <span className="border-t border-divider pt-2">
                <span className="block text-report-lead text-balance">{one.title}</span>
                <span className="mt-2 block max-w-[52ch] text-report-small text-muted-foreground">
                  {one.text}
                </span>
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

interface LayerColumnProps {
  readonly index: number;
  readonly layer: ReportContent['figureTexts']['fig1']['layers'][number];
}

function LayerColumn({ index, layer }: LayerColumnProps) {
  const { openNode } = useReport();
  const { methodUi } = useContent();
  const key = LAYER_KEYS[index] ?? layer.k;
  const nodes = reportGraph.layer(key);
  const open = (node: GraphNode, target: HTMLElement) => {
    openNode(node.node_id, target);
  };
  return (
    <>
      <div className="flex items-baseline justify-between gap-4">
        <p className="font-mono text-report-label text-label tabular-nums">
          {String(index + 1).padStart(2, '0')}
        </p>
      </div>
      <h4 className="mt-2 text-report-heading leading-[0.95] tracking-[-0.045em]">{layer.k}</h4>
      <p className="mt-3 text-report-small text-balance text-muted-foreground">{layer.d}</p>
      <ul className="mt-5 border-t border-divider">
        {layer.items.map((item) => (
          <li key={item} className="border-b border-divider py-2 text-report-small">
            {item}
          </li>
        ))}
      </ul>
      <details className="group mt-5 border-t border-divider">
        <summary
          className={cn(
            'flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-mono text-report-label text-label hover:text-foreground',
            FOCUS,
          )}
        >
          {methodUi.layers.open}
          <span aria-hidden="true" className="transition-transform group-open:rotate-45">
            +
          </span>
        </summary>
        <ul className="flex flex-wrap gap-1 pb-2">
          {nodes.map((node) => (
            <li key={node.node_id}>
              <button
                type="button"
                onClick={(event) => {
                  open(node, event.currentTarget);
                }}
                className={cn(
                  'flex min-h-11 items-center border border-border px-2 text-report-small hover:border-foreground',
                  FOCUS,
                )}
              >
                {node.short_label}
              </button>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
}
