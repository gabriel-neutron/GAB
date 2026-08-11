/**
 * PROTOTYPE — variant A · Immersive canvas. **The variant the operator chose.**
 *
 * The bet: the picture is the product. The graph fills its column, and the only things over it
 * are the filter row and the legend. It draws **no detail panel of its own** — the operator asked
 * to reuse the sidebar of `features/detail/`, and a feature cannot import a feature (ADR 0004
 * §5), so this variant announces its selection and the route puts the sidebar beside it.
 *
 * The cost readout that used to sit in the top right corner is gone from the design surface. It
 * is instrumentation, so it goes to the prototype bar, which is deliberately not part of any
 * design under judgement.
 *
 * ADR 0004 §3 holds. One `useRef` per anchor, one effect at mount, and no state.
 */

import { memo, useEffect, useRef } from 'react';
import { emitGraphCost, emitGraphSelection } from './prototype-bridge';
import { buildFilters, buildLegend } from './prototype-chrome';
import { el } from './prototype-dom';
import { costLine, mountGraph } from './prototype-mount';

export const VariantA = memo(function VariantA({ entityCount }: { entityCount: number }) {
  const canvas = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const filters = useRef<HTMLDivElement>(null);
  const legend = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasNode = canvas.current;
    const overlayNode = overlay.current;
    const statusNode = status.current;
    const filtersNode = filters.current;
    const legendNode = legend.current;
    if (
      canvasNode === null ||
      overlayNode === null ||
      statusNode === null ||
      filtersNode === null ||
      legendNode === null
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

        // The one line of state the analyst wants on the canvas: how much of the picture is out
        // of consideration. Everything else moved to the prototype bar.
        const counts = el('div', 'mt-1 border-t border-border pt-1 text-[11px] tabular-nums');
        legendNode.append(counts);

        emitGraphCost(
          `${costLine(model)} · ${model.pendingWithoutTarget.length} pending proposals have no element to badge (#10)`,
        );

        let last: string | null = null;
        return controller.subscribe((view) => {
          repaintFilters(view);
          counts.textContent =
            `${view.lit.toLocaleString('en-GB')} lit · ${view.dimmed.toLocaleString('en-GB')} dimmed` +
            (view.badgesDrawn > 0 ? ` · ${view.badgesDrawn} badged` : '') +
            (view.badgesOverCap > 0 ? ` (${view.badgesOverCap} over the cap)` : '');

          // Announce only a change. The badge counter republishes on a frame, and the sidebar
          // must not be told the same thing many times a second.
          const key = view.selection === null ? '' : `${view.selection.kind}:${view.selection.id}`;
          if (key === last) return;
          last = key;
          emitGraphSelection(view.selection);
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
      {/*
        `pointer-events-none` on the box and `auto` on its contents. A pan that starts on the
        padding of a control panel must still pan the graph under it; without this the corner is
        dead to the drag that the canvas exists for.

        No radius, a 1px hairline, and no blur: `src/theme.css` rules 5 to 7.
      */}
      <div className="pointer-events-none absolute left-3 top-3 z-20 w-52 border border-border bg-background p-2">
        <div ref={filters} className="pointer-events-auto flex flex-col gap-0.5" />
      </div>
      <div className="pointer-events-none absolute bottom-3 left-3 z-20 flex flex-col gap-1 border border-border bg-background p-2">
        <div ref={legend} className="flex flex-col gap-1" />
      </div>
    </div>
  );
});
