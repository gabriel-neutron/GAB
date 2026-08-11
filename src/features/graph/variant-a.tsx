/**
 * PROTOTYPE — variant A · Immersive canvas.
 *
 * The bet: the picture is the product. The graph fills the page, every control floats over it,
 * and the detail panel is an overlay that can be dismissed. Nothing competes with the canvas.
 *
 * ADR 0004 §3 holds. One `useRef` per anchor, one effect at mount, and no state.
 */

import { memo, useEffect, useRef } from 'react';
import { buildFilters, buildLegend } from './prototype-chrome';
import { el, renderDetail, renderEmpty } from './prototype-dom';
import { costLine, mountGraph } from './prototype-mount';

export const VariantA = memo(function VariantA({ entityCount }: { entityCount: number }) {
  const canvas = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const filters = useRef<HTMLDivElement>(null);
  const cost = useRef<HTMLDivElement>(null);
  const legend = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasNode = canvas.current;
    const overlayNode = overlay.current;
    const statusNode = status.current;
    const filtersNode = filters.current;
    const costNode = cost.current;
    const legendNode = legend.current;
    const panelNode = panel.current;
    if (
      canvasNode === null ||
      overlayNode === null ||
      statusNode === null ||
      filtersNode === null ||
      costNode === null ||
      legendNode === null ||
      panelNode === null
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

        const counts = el('div', 'text-[11px] tabular-nums text-muted-foreground');
        costNode.replaceChildren(el('div', 'font-medium text-foreground', costLine(model)), counts);

        const head = el('div', 'flex shrink-0 items-center justify-between gap-2 pb-2');
        const title = el('span', 'text-xs font-semibold uppercase tracking-wider', 'Detail');
        const close = document.createElement('button');
        close.type = 'button';
        close.className = 'rounded px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent';
        close.textContent = 'close';
        close.addEventListener('click', () => {
          controller.select(null);
        });
        head.append(title, close);

        const body = el('div', 'flex min-h-0 flex-1 flex-col');
        panelNode.replaceChildren(head, body);

        return controller.subscribe((view) => {
          repaintFilters(view);
          counts.textContent =
            `${view.lit.toLocaleString('en-GB')} lit · ${view.dimmed.toLocaleString('en-GB')} dimmed · ` +
            `${view.badgesDrawn} badges drawn${view.badgesOverCap > 0 ? `, ${view.badgesOverCap} over the cap` : ''} · ` +
            `${model.pendingWithoutTarget.length} pending proposals have no element to badge (#10)`;

          panelNode.style.display = view.detail === null ? 'none' : 'flex';
          if (view.detail !== null) {
            renderDetail(
              body,
              view.detail,
              (selection) => {
                controller.select(selection);
              },
              'stacked',
            );
          } else {
            renderEmpty(body, 'Nothing selected.');
          }
        });
      },
    );
  }, [entityCount]);

  return (
    <div className="relative size-full overflow-hidden rounded-lg border border-border bg-background">
      <div ref={canvas} className="absolute inset-0" />
      <div ref={overlay} className="pointer-events-none absolute inset-0 z-10" />
      <div
        ref={status}
        className="absolute inset-0 z-30 items-center justify-center bg-background/85 text-sm font-medium"
        style={{ display: 'none' }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-3">
        <div
          ref={filters}
          className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-background/90 p-2 backdrop-blur"
        />
        <div
          ref={cost}
          className="pointer-events-auto max-w-[420px] rounded-lg border border-border bg-background/90 px-2.5 py-1.5 text-right text-[11px] backdrop-blur"
        />
      </div>
      <div
        ref={legend}
        className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-col gap-1 rounded-lg border border-border bg-background/90 p-2 backdrop-blur"
      />
      <div
        ref={panel}
        className="absolute inset-y-3 right-3 top-20 z-20 w-[380px] flex-col rounded-lg border border-border bg-background/95 p-3 shadow-xl backdrop-blur"
        style={{ display: 'none' }}
      />
    </div>
  );
});
