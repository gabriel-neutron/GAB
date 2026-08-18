/**
 * The graph surface — the live canvas, and the panels beside it.
 *
 * Built from `docs/graph-surface.md` §4.3, §4.4, §4.5, §4.6, §4.7, §5.1, §5.2, §5.4, §5.5 and §8
 * step 4, and from every rule of `CANVAS.md`. It is the entry point of the feature, so it keeps
 * the `-page` name.
 *
 * **This file owns the two elements, and `./controller` owns the library.** ADR 0004 §2 and §3.
 * One `ref` for the canvas, one `ref` for the marker overlay, one `useEffect` that calls
 * `mountGraph` and returns `destroy`. That effect is the adapter, which is where `CANVAS.md`
 * permits it. **The mount is idempotent and the cleanup is complete**: React invokes the effect
 * two times in development, `mountGraph` destroys an instance it finds on the same element, and
 * the cleanup removes the listener and kills the instance.
 *
 * **The live element is inside a memoised child that takes the two refs and nothing else.** A ref
 * is one object for the life of this component, so no later render of this file can build the
 * element again. A second element is a second WebGL context, the browser drops the older one, and
 * the failure looks like a blank canvas and is not one.
 *
 * **The published view is React state, above that memoised child, and §4.7 sanctions it in as
 * many words:** "The route holds the selection in React state; the canvas is memoised, so a change
 * of the selection never reaches it." Read with `CANVAS.md`, which refuses React state in an
 * **ancestor** of the live element: the memo is what makes the two agree, and it is a rule and not
 * an improvement of speed. **Do not remove it.**
 *
 * **The selection leaves on an event, and never on a property** — §4.6. `./controller` calls
 * `emitGraphSelection`, and the route listens. A property from the route is a new function on
 * every render of the route, and that defeats the memoisation above.
 *
 * **`eslint.config.ts` refuses a story for this file by name**, because one story is one live
 * WebGL context. The panels beside the canvas are storied on their own.
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import { corpus } from '@/shared/fixtures/corpus';
import { cn } from '@/shared/lib/utils';
import { Rail, type RailAct } from '@/shared/rail';

import { emitGraphSelection } from './bridge';
import { mountGraph, type FilterState, type GraphController, type GraphView } from './controller';
import type { GraphModel } from './model';
import { deriveRailRows, everyTypeShown, hiddenAfterSwitch, type RailStep } from './rail-rows';
import { IndexRows } from './row';

/**
 * What one publish of `./controller` gives this file.
 *
 * The model travels with the view because a theme change builds the model again (§4.2), and the
 * rows of the rail and the lines of the legend are read from it. `./controller` states that the
 * model is a getter and that a caller reads it again at each publish.
 */
interface GraphSnapshot {
  readonly view: GraphView;
  readonly model: GraphModel;
}

interface GraphCanvasProps {
  /** The element Sigma takes and owns. Its size comes from the layout, never from its content. */
  readonly canvas: RefObject<HTMLDivElement | null>;
  /** The element that carries the ring and each marker of UC5, over the canvas. */
  readonly overlay: RefObject<HTMLDivElement | null>;
}

/**
 * The live element, and nothing else.
 *
 * **It takes two refs and no value of the view**, so `memo` holds for every render of the page: a
 * ref is the same object at each render. `CANVAS.md`: no React render inside the tree that wraps
 * the live element.
 */
const GraphCanvas = memo(function GraphCanvas({ canvas, overlay }: GraphCanvasProps) {
  return (
    <>
      <div ref={canvas} className={cn('absolute inset-0')} />
      {/* The overlay is positioned, because `./controller` puts an absolute layer inside it. It
          takes no pointer event, so a drag that starts on it still moves the graph — §5.5. */}
      <div ref={overlay} className={cn('pointer-events-none absolute inset-0')} />
    </>
  );
});

export interface GraphPageProps {
  /** PROTOTYPE — the visual vocabulary the address asked for. See `shared/marks.prototype.ts`. */
  readonly variant?: string | undefined;
}

export function GraphPage({ variant }: GraphPageProps) {
  const canvas = useRef<HTMLDivElement | null>(null);
  const overlay = useRef<HTMLDivElement | null>(null);
  /** The handle of §4.3. The rail and the legend drive the graph through it, and never around it. */
  const controller = useRef<GraphController | null>(null);

  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);

  /**
   * The filter of the last publish. **It is a ref and not a second store**: the value lives on the
   * view that `./controller` owns, and this holds the same value only so that a stable callback
   * can read it. A `useCallback` that took the filter in its list would build a new function on
   * every filter change, and `GraphCanvas` is memoised on the props it is given.
   *
   * The shared rail says what the analyst did — a type, and the state asked for — and the polarity
   * of §5.2 is answered here, with `hiddenAfterSwitch`.
   */
  const filterNow = useRef<FilterState | null>(null);

  /**
   * The two steps of the rail. **This value dies with the view**, so React state is where ADR 0004
   * §7 puts it, and `CANVAS.md` permits it beside a memoised canvas. It is held here, and not in
   * `./rail`, because `deriveRailRows` needs both fields to build the rows, and a value in two
   * stores is the fault the ADR names.
   */
  const [step, setStep] = useState<RailStep>({ openTypes: [], wholeList: [] });

  /**
   * The one effect of this file, and it is the adapter — `CANVAS.md` permits a `useEffect` there
   * and in a subscription, and this is both.
   *
   * The list is empty. `corpus` is a module import, and the two refs are stable, so nothing here
   * can mount a second graph.
   *
   * `subscribe` calls its listener at once with the view of that moment, so this file needs no
   * seeding path of its own: a component that subscribes after the canvas is built has already
   * missed the restore of the address.
   */
  useEffect(() => {
    const element = canvas.current;
    const marks = overlay.current;
    // Both elements are in the returned tree, so React has attached them before this effect runs.
    // This test states that, and it invents no second mounting path.
    if (element === null || marks === null) return;

    // **Nothing is selected until this graph says so.** `./bridge` holds the last announcement for
    // a subscriber that attaches after the mount, and nothing else clears it: a `mountGraph` that
    // throws — no WebGL context is the real case — announces nothing, and the route is then seeded
    // with the selection of the **previous** mount and draws an entity that no canvas drew.
    emitGraphSelection(null);

    const handle = mountGraph(element, marks, corpus, variant);
    controller.current = handle;
    const unsubscribe = handle.subscribe((view) => {
      filterNow.current = view.filter;
      setSnapshot({ view, model: handle.model });
    });

    return () => {
      unsubscribe();
      handle.destroy();
      // A destroyed graph answers nothing, so the held announcement goes with it.
      emitGraphSelection(null);
      // A cleanup of an older mount must not drop the handle of a newer mount.
      if (controller.current === handle) controller.current = null;
    };
    // PROTOTYPE: the variant is in the list, so a change of it mounts the graph again. That is the
    // whole point — the vocabulary is baked into the style at the mount. The list is empty again
    // when `marks.prototype.ts` goes.
  }, [variant]);

  /**
   * The rows of the rail. The derivation is in `./rail-rows`: this file sorts nothing, caps
   * nothing and counts nothing.
   *
   * **The memo reads the four values the rows are built from, and never the whole snapshot.** A
   * publish builds a new snapshot object, and a fold of the rail or of the legend is a publish. On
   * the snapshot this memo therefore ran `deriveRailRows` again for one click on a chevron — two
   * walks of every node and a sort, which is about twenty thousand iterations at the ten thousand
   * entities of §2. `./controller` keeps the identity of each value that did not change, so the
   * four dependencies below hold across a fold.
   */
  const model = snapshot?.model ?? null;
  const filter = snapshot?.view.filter ?? null;
  const selection = snapshot?.view.selection ?? null;
  // The fold of the rail is the fifth value the rows are built from, and it is read on its own for
  // the same reason as the four above: the whole snapshot is a new object at each publish, so a
  // memo that took it would run the derivation again for one click on a chevron.
  const railOpen = snapshot?.view.railOpen ?? false;
  const rows = useMemo(
    () =>
      model === null || filter === null
        ? null
        : deriveRailRows(model, filter, step, selection, railOpen),
    [model, filter, step, selection, railOpen],
  );

  const act = useCallback((next: RailAct) => {
    const handle = controller.current;
    if (handle === null) return;
    switch (next.kind) {
      case 'open-rail':
        handle.setRailOpen(next.open);
        return;
      case 'switch-type': {
        // §5.2: the workspace holds the types that are switched **off**. `./rail-rows` holds that
        // polarity, so the shared control states the act and never the set it produces.
        const filter = filterNow.current;
        if (filter === null) return;
        handle.setFilter({ hiddenTypes: hiddenAfterSwitch(filter, next.type, next.on) });
        return;
      }
      case 'show-every-type':
        handle.setFilter({ hiddenTypes: everyTypeShown() });
        return;
      case 'open-type':
        // #82 C5: more than one type may stand unfolded, so this adds and removes one name.
        // **Folding a type also forgets that its whole list was open**, so opening it again
        // starts at the cap and #82 C8 states the remainder afresh.
        setStep((held) =>
          next.open
            ? { ...held, openTypes: [...held.openTypes, next.type] }
            : {
                openTypes: held.openTypes.filter((type) => type !== next.type),
                wholeList: held.wholeList.filter((type) => type !== next.type),
              },
        );
        return;
    }
  }, []);

  /**
   * #82 C8: the line that counted the rows the cap dropped is a control now, and it draws them in
   * the same order — the hubs first.
   *
   * **It is not an act of the shared rail.** The cap belongs to this surface: the map lists every
   * entity of a type and has nothing to open. An act on the shared control would put a rule of one
   * surface into a file that both surfaces read.
   */
  const showWholeList = useCallback((type: string) => {
    setStep((held) =>
      held.wholeList.includes(type) ? held : { ...held, wholeList: [...held.wholeList, type] },
    );
  }, []);

  /**
   * §5.1: a **control** may move the camera, and a click on a node may not. A row of the index is
   * that control, so the selection and the move happen together here.
   */
  const reach = useCallback((id: string) => {
    const handle = controller.current;
    if (handle === null) return;
    handle.select({ kind: 'entity', id });
    handle.flyTo(id);
  }, []);

  return (
    <div className={cn('relative size-full overflow-hidden')}>
      <GraphCanvas canvas={canvas} overlay={overlay} />

      {/* §5.5: each floating panel takes no pointer event on its own padding, and neither does the
          box that places it. A drag that starts there still moves the graph below. */}
      <div className={cn('pointer-events-none absolute inset-y-2 left-2 flex')}>
        {snapshot === null || rows === null ? null : (
          <Rail
            rows={rows.rail}
            onAct={act}
            // #82 C5: the rail asks for each open list, because more than one may stand open.
            index={(type) => {
              const list = rows.lists.get(type);
              return list === undefined ? null : (
                <IndexRows
                  entities={list.entities}
                  remainder={list.remainder}
                  onSelect={reach}
                  onShowWholeList={() => {
                    showWholeList(type);
                  }}
                />
              );
            }}
            // §5.5: the panel floats over the canvas, so it takes the popover ground and no
            // pointer event on its own padding. Each control inside takes the pointer back.
            className={cn(
              'pointer-events-none max-h-full border border-border bg-popover',
              'text-popover-foreground',
              rows.rail.open ? 'w-64' : 'w-11',
            )}
          />
        )}
      </div>
    </div>
  );
}
