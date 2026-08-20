/**
 * The map surface — the live canvas, and the seam upward.
 *
 * Built from `docs/map-surface.md` §3.4, §4.8, §5.1 and §8 step 5. It is the entry point of the
 * feature, so it keeps the `-page` name.
 *
 * **This file owns the element, and `adapter.ts` owns the library.** ADR 0004 §2 and §3. Each
 * value that the map keeps — the camera, the types that are switched off, the selection — lives
 * outside React, inside the adapter. **No camera, no style and no selection is in React here.**
 *
 * **The instance is in a `ref`, and never in React state** — `CANVAS.md`: "One `ref`, one
 * imperative adapter, and every other value outside React", and "the instance in React state
 * above the live element is the fault the ADR names". Two values of this file are in React, and
 * neither is the instance. The first says that the map exists. The second is the open state of the
 * rail, which is the workspace (ADR 0004 §7) and which the rail takes as a prop so that it reads
 * no `localStorage` and stays storiable. Both are named again where they are declared.
 *
 * **The element that carries the canvas is memoised.** That is a rule, and not an improvement of
 * speed. Step 6 puts the rail beside this element, and the rail holds ordinary React state. A
 * render that builds a new element removes the old node, and the WebGL context goes with it. The
 * memo takes an empty list, so no render of this component and no state of the rail can reach it.
 *
 * **The restore is one way, and it occurs one time** — §5.1. `mountMap` reads `?entity=` at the
 * mount, and this file never pushes the address back into the map. So this file calls no router
 * hook and reads no `localStorage`: a two-way binding between a router and a live canvas is a
 * loop, and the adapter already owns the workspace and the address.
 *
 * **One subscription does the seed and the listen** — §5.1. A component that subscribes after the
 * map is built has already missed the restore, so `handle.onSelect` calls its listener at once
 * with the selection of that moment. This file therefore adds no second seeding path.
 *
 * **This file states no height, and it invents no number.** §4.8 gives the route the composition,
 * and the route states the height of the row. So this element takes the height it is given. A
 * height of one viewport here would be more than that space, and the map would be cut at the
 * bottom.
 *
 * The width comes from `flex-1 min-w-0`, which is `flex-basis: 0` and not `auto`. So the content
 * of the element never decides its size, and the loop that `MountMapOptions.container` records
 * cannot start.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { corpus } from '@/shared/fixtures/corpus';

import { mountMap, type MapHandle } from './adapter';
import { project } from './projection';
import { GroundControl } from './ground-control';
import { Rail } from './rail';
import { patchMapWorkspace, readMapWorkspace } from './workspace';

export interface MapPageProps {
  /**
   * The analyst selected an entity, or cleared the selection. The route puts the identity in the
   * address.
   *
   * **This function must be the same function at each render of the caller.** §3.4 gives the
   * canvas props that never change on a selection, and that is what keeps the re-render of the
   * route away from the live element. A caller that builds a new function at each render mounts a
   * new map at each render, and that is the fault §3.4 names.
   */
  readonly onSelect: (id: string | null) => void;
  /**
   * The analyst chose a relation with a click on a line, or ended that choice — #89. The route
   * draws the detail view of it.
   *
   * **`adapter.ts` ends the choice on its own**, on a click on a point and on a click on the
   * ground, and it calls this with `null` when it does. So the route needs no second rule for
   * when a relation stops being chosen.
   *
   * **This function must be the same function at each render of the caller**, for the reason
   * `onSelect` above states.
   */
  readonly onChooseRelation: (id: string | null) => void;
}

/**
 * **Two React values live in an ancestor of the canvas, and the operator ruled that this is
 * permitted** — #89, on 19 August 2026. `CANVAS.md` said "Where a value must sit in an ancestor of
 * the canvas, stop and ask the operator", and the same answer came back four times. The rule the
 * operator gave: a value that is not the instance, the camera, the style or the selection may sit
 * in an ancestor, **if the element that carries the canvas is memoised on a list that cannot
 * change**. The two here are `mapReady`, which says that the map exists, and `railOpen`, which is
 * the workspace field the rail takes as a prop. The element below is memoised on an empty list.
 *
 * **The edit that puts this rule into `CANVAS.md` is under ASK**, because the operator owns every
 * document. Until it lands, this note is the record of the decision.
 */
export function MapPage({ onSelect, onChooseRelation }: MapPageProps) {
  const host = useRef<HTMLDivElement | null>(null);
  /**
   * The handle of the live map. **`CANVAS.md`: one `ref`, one imperative adapter.** The rail is a
   * sibling of the canvas, and it drives the map through this ref. The ref itself never changes,
   * so the rail takes a value that no render can replace.
   */
  const handle = useRef<MapHandle | null>(null);

  /**
   * Whether the map exists. **This is readiness, and it is not the instance.** `CANVAS.md` names
   * "the instance in React state above the live element" as the fault, and a boolean is not the
   * instance, the camera, the style or the selection. The mount effect writes it one time, so it
   * changes once in the life of the view.
   *
   * The rail needs it because a child runs its effect before its parent: a rail that mounted at
   * the first render would read a ref that the mount effect had not filled. So this file renders
   * the rail at the render after the map exists. The element below is memoised on an empty list,
   * so this state reaches no render of the live element.
   */
  const [mapReady, setMapReady] = useState(false);

  /**
   * Whether the rail shows its index. **The workspace holds it** — ADR 0004 §7 and §5.4. The rail
   * takes it as a prop, so the rail reads no `localStorage` and stays storiable. This file is the
   * second writer of the record, and it patches: §4.4 gives the workspace four writers, and two
   * writers that each hold a partial record erase the other's field.
   */
  const [railOpen, setRailOpen] = useState<boolean>(() => readMapWorkspace().railOpen);

  const changeRailOpen = useCallback((next: boolean) => {
    setRailOpen(next);
    patchMapWorkspace({ railOpen: next });
  }, []);

  /**
   * The corpus, reduced to what a map can draw. It is built one time, and the empty list says so.
   *
   * `adapter.ts` keys each feature of the style to the `fid` of this one projection, and `fid` is
   * a position in its array. A second projection carries identifiers that the live map does not
   * hold.
   */
  const projection = useMemo(() => project(corpus), []);

  /**
   * The one effect of this file, and it is the adapter — the skill puts a `useEffect` in an
   * adapter or in a subscription, and this is both.
   *
   * **No value of the list can change.** `projection` comes from an empty memo, and `onSelect`
   * and `onChooseRelation` are the two props, which §3.4 requires to be the same function at each
   * render. A caller that breaks that contract mounts the map again, which is loud, instead of
   * driving a listener that this file captured before.
   *
   * **The mount does the same thing each time, and the cleanup is complete** — §5.3. React 19
   * StrictMode runs setup, cleanup, setup in development. `mountMap` destroys an instance that it
   * finds on the same element, and this cleanup removes the listener, destroys the map and drops
   * the handle. So two runs leave one map and no listener.
   */
  useEffect(() => {
    const container = host.current;
    // The element is memoised below and it is in the returned tree, so React has attached it
    // before this effect runs. This test states that, and it invents no second mounting path.
    if (container === null) return;

    const map = mountMap({ container, projection });
    handle.current = map;
    setMapReady(true);
    const unsubscribe = map.onSelect(onSelect);
    // **The chosen relation leaves the canvas the same way the selection does** — #89, and #76
    // item 2, which held `chosenLink` and `onChooseLink` on the handle until a chosen relation
    // had somewhere to appear. `onChooseLink` calls its listener at once with the choice of that
    // moment, as `onSelect` does, so this subscription needs no second seeding path.
    const stopChoosing = map.onChooseLink((link) => {
      onChooseRelation(link?.id ?? null);
    });

    return () => {
      unsubscribe();
      stopChoosing();
      map.destroy();
      // A cleanup of an older mount must not drop the handle of a newer mount.
      if (handle.current !== map) return;
      handle.current = null;
      setMapReady(false);
    };
  }, [projection, onSelect, onChooseRelation]);

  /**
   * **The element is memoised, and the empty list is the reason it works.** CANVAS.md: no React
   * render inside the tree that wraps the live element. This element takes nothing from this
   * component, so no later render — the readiness above, or the rail beside it — can build it
   * again. A list that cannot change is what makes that true.
   *
   * The width comes from `flex-1 min-w-0`, and the height from the row above. Neither comes from
   * the content, so the observer of `adapter.ts` reads no size that it wrote itself.
   */
  const canvas = useMemo(() => <div ref={host} className="h-full min-w-0 flex-1" />, []);

  // The rail is a **sibling** of the canvas — `CANVAS.md`. It holds ordinary React state, and the
  // memo above is what keeps that state away from the live element. The rail changes the width of
  // this row when it opens and closes, and the `ResizeObserver` of `adapter.ts` answers that.
  // The rail is a **sibling** of the canvas — `CANVAS.md`. So is the ground control, which #81
  // rows A2 and B8 moved out of the rail and onto the map. Both hold ordinary React state, and the
  // memo above is what keeps that state away from the live element.
  //
  // **The wrapper is what the ground control is placed against**, and it is the flex child the
  // canvas used to be. The canvas keeps `flex-1`, so the wrapper is a flex row of its own and the
  // element measures exactly what it measured before.
  return (
    <div className="flex h-full">
      {mapReady ? (
        <Rail projection={projection} map={handle} open={railOpen} onOpenChange={changeRailOpen} />
      ) : null}
      <div className="relative flex min-w-0 flex-1">
        {canvas}
        {mapReady ? <GroundControl map={handle} /> : null}
      </div>
    </div>
  );
}
