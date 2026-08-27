import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';

import type { Corpus, TypeVocabulary } from '@/shared/read/model';
import { cn } from '@/shared/lib/utils';
import { Rail, type RailAct } from '@/shared/rail';

import { emitGraphSelection } from './bridge';
import { mountGraph, type FilterState, type GraphController, type GraphView } from './controller';
import { MarkerRemainder } from './marker-remainder';
import type { GraphModel } from './model';
import { deriveRailRows, everyTypeShown, hiddenAfterSwitch, type RailStep } from './rail-rows';
import { IndexRows } from './row';

interface GraphSnapshot {
  readonly view: GraphView;
  readonly model: GraphModel;
}

interface GraphCanvasProps {
  readonly canvas: RefObject<HTMLDivElement | null>;
  readonly overlay: RefObject<HTMLDivElement | null>;
}

// It takes two refs and no value, so `memo` holds at every render: a ref is one object for the
// life of the component. A render above the live element builds a second element and a second
// WebGL context; the browser drops the older one and the canvas goes blank.
const GraphCanvas = memo(function GraphCanvas({ canvas, overlay }: GraphCanvasProps) {
  return (
    <>
      <div ref={canvas} className={cn('absolute inset-0')} />
      {/* The overlay is positioned, because the controller puts an absolute layer inside it.
          It takes no pointer event, so a drag that starts on it still moves the graph. */}
      <div ref={overlay} className={cn('pointer-events-none absolute inset-0')} />
    </>
  );
});

export interface GraphPageProps {
  // The record this canvas draws. It arrives as a value, so the canvas never reads a store that
  // may hold nothing, and a later read of the record reaches the graph as a new value.
  readonly corpus: Corpus;
  /** The declared types. The canvas paints a node in the hue its type states. */
  readonly types: TypeVocabulary;
}

export function GraphPage({ corpus, types }: GraphPageProps) {
  const canvas = useRef<HTMLDivElement | null>(null);
  const overlay = useRef<HTMLDivElement | null>(null);
  const controller = useRef<GraphController | null>(null);

  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);

  // A ref, not a second store: the value lives on the view. A `useCallback` with the filter in its
  // list would make a new function at each filter change, and `GraphCanvas` is memoised on props.
  const filterNow = useRef<FilterState | null>(null);

  const [step, setStep] = useState<RailStep>({ openTypes: [], wholeList: [] });

  // The list holds the record and the declared types, and no ref: a ref is one object for the
  // life of the component. A later read of either one mounts a new graph, which is how a refresh
  // reaches this canvas. `subscribe` seeds a new listener, so this file seeds nothing.
  useEffect(() => {
    const element = canvas.current;
    const marks = overlay.current;
    if (element === null || marks === null) return;

    // The bridge holds the last announcement, and nothing else clears it. A `mountGraph` that
    // throws, and no WebGL context is the real case, announces nothing. The route is then seeded
    // with the selection of the previous mount, and draws an entity that no canvas drew.
    emitGraphSelection(null);

    const handle = mountGraph(element, marks, corpus, types);
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
  }, [corpus, types]);

  // The memo reads the values the rows are built from, and never the whole snapshot. A publish
  // makes a new snapshot object, and a fold is a publish. A memo that took the whole snapshot
  // would run `deriveRailRows` again: two walks and a sort, 20000 iterations at 10000 entities.
  const model = snapshot?.model ?? null;
  const filter = snapshot?.view.filter ?? null;
  const selection = snapshot?.view.selection ?? null;
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
        // The workspace holds the types that are switched **off**. The rows of the rail hold
        // that polarity, so the shared control states the act and never the set it produces.
        const filter = filterNow.current;
        if (filter === null) return;
        handle.setFilter({ hiddenTypes: hiddenAfterSwitch(filter, next.type, next.on) });
        return;
      }
      case 'show-every-type':
        handle.setFilter({ hiddenTypes: everyTypeShown() });
        return;
      case 'open-type':
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

  const showWholeList = useCallback((type: string) => {
    setStep((held) =>
      held.wholeList.includes(type) ? held : { ...held, wholeList: [...held.wholeList, type] },
    );
  }, []);

  const reach = useCallback((id: string) => {
    const handle = controller.current;
    if (handle === null) return;
    handle.select({ kind: 'entity', id });
    handle.flyTo(id);
  }, []);

  return (
    <div className={cn('relative size-full overflow-hidden')}>
      <GraphCanvas canvas={canvas} overlay={overlay} />

      {/* Each floating panel takes no pointer event on its own padding, and neither does the box
          that places it. A drag that starts there still moves the graph below. */}
      <div className={cn('pointer-events-none absolute inset-y-2 left-2 flex')}>
        {snapshot === null || rows === null ? null : (
          <Rail
            rows={rows.rail}
            onAct={act}
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
            className={cn(
              'pointer-events-none max-h-full border border-border bg-popover',
              'text-popover-foreground',
              rows.rail.open ? 'w-64' : 'w-11',
            )}
          />
        )}
      </div>

      {/* The line corrects the canvas, so it stands on the canvas. The rail folds away and the
          fold is stored, so a reader could hide this report for good and never meet it again. */}
      <div className={cn('pointer-events-none absolute right-2 bottom-2 flex')}>
        {snapshot === null ? null : (
          <MarkerRemainder
            drawn={snapshot.view.markersDrawn}
            remainder={snapshot.view.markersOverCap}
          />
        )}
      </div>
    </div>
  );
}
