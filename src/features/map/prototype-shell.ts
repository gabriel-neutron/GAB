/**
 * PROTOTYPE — throwaway. The plan, and the one entry point of the feature.
 *
 * > Three variations of the index row, on the existing `/map` route, chosen by `?variant=`,
 * > with the detail sidebar composed beside them by the route.
 *
 * ------------------------------------------------------------------------------------------
 * What is settled, and what is not
 * ------------------------------------------------------------------------------------------
 *
 * Settled by the operator: the analyst is **locating**; the left bar is a rail, and it is the
 * **two-step rail** — types first, one type unfolded at a time. Neither is under review now.
 *
 * Open, and the reason this prototype exists: **a row that says only a name does not tell two
 * similar entities apart.** The three variations differ in what else a row says, in how much
 * room it takes to say it, and — the harder half — in the **rule** that chooses which attribute
 * is worth showing. `prototype-rows.ts` holds all three.
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
 * - the camera, the hidden types and the open state of the rail are in `localStorage` — **#33**;
 * - the variation is in `/map?variant=`, and it is scaffolding that dies with the prototype.
 */

import { mountBar } from './prototype-bar';
import { ROW_KEYS, ROW_STYLES, type RowKey } from './prototype-rows';

export { nextRow, parseRow, ROW_KEYS, type RowKey } from './prototype-rows';

export const ROW_NAMES: Readonly<Record<RowKey, string>> = Object.fromEntries(
  ROW_KEYS.map((key) => [key, ROW_STYLES[key].name]),
) as Record<RowKey, string>;

/**
 * Idempotent, because React 19 double-invokes an effect in development and the cleanup runs
 * between the two. Clearing the node first also kills a stray child from any other cause.
 */
export function mountSurface(root: HTMLElement, row: RowKey): () => void {
  root.replaceChildren();
  root.style.position = 'relative';
  const unmount = mountBar(root, row);

  return () => {
    unmount();
    root.replaceChildren();
  };
}
