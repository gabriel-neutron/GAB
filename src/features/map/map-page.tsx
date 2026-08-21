// The restore is one way: `mountMap` reads `?entity=` at the mount, and this file pushes no
// address back. A two-way binding between a router and a live canvas is a loop, so this file
// calls no router hook and reads no `localStorage`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { corpus } from '@/shared/fixtures/corpus';

import { mountMap, type MapHandle } from './adapter';
import { project } from './projection';
import { GroundControl } from './ground-control';
import { Rail } from './rail';
import { patchMapWorkspace, readMapWorkspace } from './workspace';

export interface MapPageProps {
  // This function must be the same function at each render of the caller. A caller that builds a
  // new function at each render mounts a new map at each render.
  readonly onSelect: (id: string | null) => void;
  // `adapter.ts` ends the choice on its own, on a click on a point and on a click on the ground,
  // and it calls this with `null` when it does. This function must be the same function at each
  // render of the caller, for the reason `onSelect` states.
  readonly onChooseRelation: (id: string | null) => void;
}

// Two React values sit in an ancestor of the canvas: `mapReady` and `railOpen`. Neither is the
// instance, the camera, the style or the selection, and the element that carries the canvas is
// memoised on an empty list. So no render of these two can reach the live element.
export function MapPage({ onSelect, onChooseRelation }: MapPageProps) {
  const host = useRef<HTMLDivElement | null>(null);
  // The rail is a sibling of the canvas, and it drives the map through this ref. The ref itself
  // never changes, so the rail takes a value that no render can replace.
  const handle = useRef<MapHandle | null>(null);

  // A child runs its effect before its parent: a rail mounted at the first render would read a
  // ref that the mount effect had not filled. So the rail renders at the render after the map
  // exists. The element below is memoised on an empty list, so this state reaches no render.
  const [mapReady, setMapReady] = useState(false);

  // The rail takes this as a prop, so the rail reads no `localStorage` and stays storiable. This
  // file patches the workspace: the record has four writers, and a writer that holds a partial
  // record erases the fields of the others.
  const [railOpen, setRailOpen] = useState<boolean>(() => readMapWorkspace().railOpen);

  const changeRailOpen = useCallback((next: boolean) => {
    setRailOpen(next);
    patchMapWorkspace({ railOpen: next });
  }, []);

  // `adapter.ts` keys each feature of the style to the `fid` of this one projection, and `fid` is
  // a position in its array. A second projection carries identifiers the live map does not hold.
  const projection = useMemo(() => project(corpus), []);

  // React 19 StrictMode runs setup, cleanup, setup in development. `mountMap` destroys an
  // instance that it finds on the same element, and this cleanup removes the listener, destroys
  // the map and drops the handle. So two runs leave one map and no listener.
  useEffect(() => {
    const container = host.current;
    // The element is memoised below and it is in the returned tree, so React has attached it
    // before this effect runs. This test states that, and it invents no second mounting path.
    if (container === null) return;

    const map = mountMap({ container, projection });
    handle.current = map;
    setMapReady(true);
    const unsubscribe = map.onSelect(onSelect);
    // `onChooseLink` calls its listener at once with the choice of that moment, as `onSelect`
    // does. So this subscription needs no second seeding path.
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

  // No React render is permitted inside the tree that wraps the live element: a render that
  // builds a new element removes the old node, and the WebGL context goes with it. The empty
  // list is what makes that true, because this element takes nothing from this component.
  const canvas = useMemo(() => <div ref={host} className="h-full min-w-0 flex-1" />, []);

  // The wrapper is what the ground control is placed against. The canvas keeps `flex-1 min-w-0`,
  // which is `flex-basis: 0` and not `auto`, so the content never decides the size and the
  // `ResizeObserver` of `adapter.ts` reads no size that it wrote itself.
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
