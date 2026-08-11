/**
 * PROTOTYPE — variant C · Three bands.
 *
 * The bet: **nothing ever covers the graph.** The controls take a band above it, the detail
 * takes a band below it, and the canvas keeps its full width at all times. The detail reads
 * across in four columns instead of down in one, so attributes, relations, the M4 relations and
 * the pending proposals are all in view together and none of them scrolls the others away.
 *
 * The cost is height. The canvas loses about a third of the page, which is the trade a reviewer
 * has to judge against variant A.
 */

import { memo, useEffect, useRef } from 'react';
import { buildFilters, buildLegend } from './prototype-chrome';
import { el, renderDetail, renderEmpty } from './prototype-dom';
import { costLine, mountGraph } from './prototype-mount';

export const VariantC = memo(function VariantC({ entityCount }: { entityCount: number }) {
  const canvas = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const filters = useRef<HTMLDivElement>(null);
  const legend = useRef<HTMLDivElement>(null);
  const cost = useRef<HTMLDivElement>(null);
  const detail = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasNode = canvas.current;
    const overlayNode = overlay.current;
    const statusNode = status.current;
    const filtersNode = filters.current;
    const legendNode = legend.current;
    const costNode = cost.current;
    const detailNode = detail.current;
    if (
      canvasNode === null ||
      overlayNode === null ||
      statusNode === null ||
      filtersNode === null ||
      legendNode === null ||
      costNode === null ||
      detailNode === null
    ) {
      return;
    }

    return mountGraph(
      entityCount,
      { canvas: canvasNode, overlay: overlayNode, status: statusNode },
      (controller) => {
        const model = controller.model;
        buildLegend(legendNode);
        const repaintFilters = buildFilters(controller, filtersNode);

        const costText = el('div', 'text-[11px] leading-snug', costLine(model));
        const counts = el('div', 'text-[11px] tabular-nums text-muted-foreground');
        const noBadge = el(
          'div',
          'text-[11px] text-amber-600 dark:text-amber-400',
          `${model.pendingWithoutTarget.length} pending proposals cannot be badged — no element exists yet (#10)`,
        );
        costNode.replaceChildren(costText, counts, noBadge);

        return controller.subscribe((view) => {
          repaintFilters(view);
          counts.textContent =
            `${view.lit.toLocaleString('en-GB')} lit · ${view.dimmed.toLocaleString('en-GB')} dimmed · ` +
            `off the graph (M4): ${model.hiddenRelations.length} · ` +
            `${view.badgesDrawn} badges drawn${view.badgesOverCap > 0 ? `, ${view.badgesOverCap} over the cap` : ''}`;

          if (view.detail !== null) {
            renderDetail(
              detailNode,
              view.detail,
              (selection) => {
                controller.select(selection);
              },
              'columns',
            );
          } else {
            renderEmpty(
              detailNode,
              'Select a node or an edge. The band keeps its height, so the graph never moves.',
            );
          }
        });
      },
    );
  }, [entityCount]);

  return (
    <div className="flex size-full flex-col gap-2 overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2">
        <div ref={filters} className="flex flex-1 flex-wrap items-center gap-1.5" />
        <div ref={legend} className="flex flex-wrap items-center gap-3" />
        <div ref={cost} className="w-full border-t border-border pt-1.5 text-right" />
      </header>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background">
        <div ref={canvas} className="absolute inset-0" />
        <div ref={overlay} className="pointer-events-none absolute inset-0 z-10" />
        <div
          ref={status}
          className="absolute inset-0 z-30 items-center justify-center bg-background/85 text-sm font-medium"
          style={{ display: 'none' }}
        />
      </div>

      <section
        ref={detail}
        className="flex h-[260px] shrink-0 flex-col overflow-hidden rounded-lg border border-border bg-background p-3"
      />
    </div>
  );
});
