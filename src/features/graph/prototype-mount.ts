/**
 * PROTOTYPE — throwaway. The mount, shared by the three variants.
 *
 * The build and the layout block the thread. That block **is** the finding for #35, so it is not
 * hidden in a worker; it is announced first, measured, and then reported on screen. Two frames
 * pass before the work starts, which is what lets the browser paint the notice.
 *
 * `StrictMode` invokes an effect twice in development. Everything below is idempotent and the
 * cleanup is complete, which is the failure ADR 0004 §3 warns about.
 */

import { createController, type GraphController } from './prototype-controller';
import { getModel, isModelCached, type PrototypeModel } from './prototype-model';

export interface MountTargets {
  readonly canvas: HTMLElement;
  readonly overlay: HTMLElement;
  readonly status: HTMLElement;
}

export function mountGraph(
  targetEntities: number,
  targets: MountTargets,
  onReady: (controller: GraphController) => () => void,
): () => void {
  let controller: GraphController | null = null;
  let teardownChrome: (() => void) | null = null;
  let frame = 0;
  // The cleanup writes this from a closure. One read is enough: the build below is synchronous,
  // so nothing can cancel while it runs.
  let cancelled = false;

  const cached = isModelCached(targetEntities);
  targets.status.textContent = cached
    ? 'Reading the cached layout…'
    : `Laying out ${targetEntities.toLocaleString('en-GB')} entities. The tab is frozen while this runs.`;
  targets.status.style.display = 'flex';

  const start = (): void => {
    if (cancelled) return;
    const model = getModel(targetEntities);
    targets.status.style.display = 'none';
    controller = createController(model, targets.canvas, targets.overlay);
    teardownChrome = onReady(controller);
  };

  // Two frames, so the notice above is painted before the thread stops.
  frame = window.requestAnimationFrame(() => {
    frame = window.requestAnimationFrame(start);
  });

  return () => {
    cancelled = true;
    window.cancelAnimationFrame(frame);
    teardownChrome?.();
    controller?.destroy();
    controller = null;
  };
}

/** The line every variant shows, because it is the report to #35. */
export function costLine(model: PrototypeModel): string {
  const c = model.cost;
  return (
    `${model.graph.order.toLocaleString('en-GB')} nodes · ` +
    `${model.graph.size.toLocaleString('en-GB')} edges — ` +
    `layout ${Math.round(c.layoutMs)} ms (${c.layoutIterations} iterations) · ` +
    `structure ${Math.round(c.structureMs)} ms · ` +
    `build ${Math.round(c.buildMs)} ms · total ${Math.round(c.totalMs)} ms`
  );
}
