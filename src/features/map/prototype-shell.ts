/**
 * PROTOTYPE — throwaway. The plan, and the one entry point of the feature.
 *
 * > Three variations of the left bar, on the existing `/map` route, chosen by `?variant=`, with
 * > the detail sidebar composed beside them by the route.
 *
 * ------------------------------------------------------------------------------------------
 * The question
 * ------------------------------------------------------------------------------------------
 *
 * The analyst is **locating**, and the operator chose the left rail on 11 August 2026. What is
 * still open is the bar itself, now that a detail sidebar stands on the right: on a 1440px
 * screen the two panels take about 670px, and the map keeps the rest. The three bars disagree
 * about how the bar gives that width back — it pushes and closes (B1), it floats and never
 * pushes (B2), or it shows the layers only and opens one type at a time (B3).
 *
 * The layer control is the same control as the type filter in all three. That is the finding
 * already reported to **#36**, and no variation reintroduces a second one.
 *
 * ------------------------------------------------------------------------------------------
 * Where the state is, and why
 * ------------------------------------------------------------------------------------------
 *
 * Nothing in this folder is React (ADR 0004 §3). The **route** owns the address and the
 * composition (ADR 0004 §5), because a feature never imports a feature and the sidebar belongs
 * to `detail/`. So:
 *
 * - the selected identifier is in `/map?entity=`, put there by the route — **#33**;
 * - the camera, the hidden types and the open state of the bar are in `localStorage` — **#33**;
 * - the variant is in `/map?variant=`, and it is scaffolding that dies with the prototype.
 */

import { mountBarB1, NAME_B1 } from './prototype-bar-b1';
import { mountBarB2, NAME_B2 } from './prototype-bar-b2';
import { mountBarB3, NAME_B3 } from './prototype-bar-b3';

export const BAR_KEYS = ['B1', 'B2', 'B3'] as const;
export type BarKey = (typeof BAR_KEYS)[number];

export const BAR_NAMES: Readonly<Record<BarKey, string>> = {
  B1: NAME_B1,
  B2: NAME_B2,
  B3: NAME_B3,
};

const MOUNTS: Readonly<Record<BarKey, (host: HTMLElement) => () => void>> = {
  B1: mountBarB1,
  B2: mountBarB2,
  B3: mountBarB3,
};

export function parseBar(value: unknown): BarKey {
  if (typeof value !== 'string') return 'B1';
  return BAR_KEYS.find((key) => key === value) ?? 'B1';
}

export function nextBar(current: BarKey, step: number): BarKey {
  const at = BAR_KEYS.indexOf(current);
  return BAR_KEYS[(at + step + BAR_KEYS.length) % BAR_KEYS.length] ?? 'B1';
}

/**
 * Idempotent, because React 19 double-invokes an effect in development and the cleanup runs
 * between the two. Clearing the node first also kills a stray child from any other cause.
 */
export function mountSurface(root: HTMLElement, bar: BarKey): () => void {
  root.replaceChildren();
  root.style.position = 'relative';
  const unmount = MOUNTS[bar](root);

  return () => {
    unmount();
    root.replaceChildren();
  };
}
