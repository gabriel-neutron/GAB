/**
 * PROTOTYPE — the graph surface. **The one the operator chose; the other two are retired.**
 *
 * The picture is the product, so the canvas takes every pixel that is not a control. Three
 * surfaces stand around it, and none of them floats over it except the legend:
 *
 * - the **left rail**, which is the two-step rail of `features/map` — the same control, because
 *   the layer panel and the type filter are one control (#36);
 * - the **right sidebar**, which is `features/detail`, composed by the route, because a feature
 *   never imports a feature (ADR 0004 §5);
 * - the **legend**, bottom left, which states the encoding and one line of counts.
 *
 * ADR 0004 §3 holds. One `useRef` per anchor, one effect at mount, and no React state.
 */

import { memo, useEffect, useRef } from 'react';
import { emitGraphCost, emitGraphSelection } from './prototype-bridge';
import { mountLegend, mountRail } from './prototype-chrome';
import { costLine, mountGraph } from './prototype-mount';

export const GraphPage = memo(function GraphPage({ entityCount }: { entityCount: number }) {
  const canvas = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLDivElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const legend = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvasNode = canvas.current;
    const overlayNode = overlay.current;
    const statusNode = status.current;
    const railNode = rail.current;
    const legendNode = legend.current;
    if (
      canvasNode === null ||
      overlayNode === null ||
      statusNode === null ||
      railNode === null ||
      legendNode === null
    ) {
      return;
    }

    return mountGraph(
      entityCount,
      { canvas: canvasNode, overlay: overlayNode, status: statusNode },
      (controller) => {
        const model = controller.model;

        const repaintRail = mountRail(controller, railNode);
        const repaintLegend = mountLegend(controller, legendNode);

        emitGraphCost(
          `${costLine(model)} · ${model.pendingWithoutTarget.length} pending proposals have no element to badge (#10)`,
        );

        let last: string | null = null;
        return controller.subscribe((view) => {
          repaintRail(view);
          repaintLegend(view);

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
    <div className="flex size-full overflow-hidden border border-border bg-background">
      <div
        ref={rail}
        className="flex shrink-0 flex-col overflow-hidden border-r border-border"
        style={{ width: '17rem' }}
      />

      <div className="relative min-w-0 flex-1">
        <div ref={canvas} className="absolute inset-0" />
        <div ref={overlay} className="pointer-events-none absolute inset-0 z-10" />
        <div
          ref={status}
          className="absolute inset-0 z-30 items-center justify-center bg-background/85 text-sm font-medium"
          style={{ display: 'none' }}
        />
        {/*
          Bottom right, opposite the rail, so the two controls do not stack in one corner.

          `pointer-events-none` on the box and `auto` on its contents: a drag that starts on the
          padding must still pan the graph under it. No radius, a 1px hairline, and no blur —
          `src/theme.css` rules 5 to 7.
        */}
        <div className="pointer-events-none absolute bottom-3 right-3 z-20 w-60 border border-border bg-background p-2">
          <div ref={legend} className="pointer-events-auto flex flex-col" />
        </div>
      </div>
    </div>
  );
});
