import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';

import type { Corpus, EntityPosition, TypeVocabulary } from '@/shared/read/model';
import { cn } from '@/shared/lib/utils';
import { Rail, type RailAct } from '@/shared/rail';
import { useScreenQuery } from '@/shared/screen-query';

import { mountGraph, type GraphController, type GraphView } from './controller';
import { FocusBar } from './focus-bar';
import { FocusNote } from './focus-note';
import { MarkerRemainder } from './marker-remainder';
import type { GraphModel } from './model';
import { deriveRailRows } from './rail-rows';
import { stepAfterTypeOpen, stepShowingWholeList, type RailStep } from './rail-step';
import { IndexRows } from './row';
import type { GraphSelection } from './selection';
import { ShownLine } from './shown-line';
import { StartPanel } from './start-panel';
import { everyTypeShown, hiddenAfterSwitch, isShown, type FilterState } from './type-filter';
import { UnplacedCount } from './unplaced-count';
import { DEFAULT_GRAPH_WORKSPACE } from './workspace';

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

/** What the graph draws. The page keeps one value for it, so a later read is one new value. */
export interface GraphRecord {
  readonly corpus: Corpus;
  /** The declared types. The canvas paints a node in the hue its type states. */
  readonly types: TypeVocabulary;
  // Where the layout run placed each entity. An entity it did not place is absent, and the canvas
  // then places it at a position read from its identifier.
  readonly layout: ReadonlyMap<string, EntityPosition>;
}

interface GraphPageProps {
  readonly record: GraphRecord;
  // This function must be the same function at each render of the caller. A caller that builds a
  // new function at each render mounts a new graph at each render.
  readonly onSelect: (selection: GraphSelection | null) => void;
  /** The card of the selection. It stands beside the canvas, and under it on a narrow screen. */
  readonly card: ReactNode;
}

/** The graph as a dark island in the light page: the types and the lists beside the canvas, and
 * the card of the selection on the other side. Under the island, the notes that correct the
 * picture. */
export function GraphPage({ record, onSelect, card }: GraphPageProps) {
  const { corpus, types, layout } = record;
  const canvas = useRef<HTMLDivElement | null>(null);
  const overlay = useRef<HTMLDivElement | null>(null);
  const controller = useRef<GraphController | null>(null);

  const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);

  // A ref, not a second store: the value lives on the view. A `useCallback` with the filter in its
  // list would make a new function at each filter change, and `GraphCanvas` is memoised on props.
  const filterNow = useRef<FilterState | null>(null);

  const [step, setStep] = useState<RailStep>({ openTypes: [], wholeList: [] });

  // The list holds the record, the declared types and one stable function, and no ref: a ref is
  // one object for the life of the component. A later read of the record mounts a new graph,
  // which is how a refresh reaches this canvas. Each subscription seeds its own listener.
  useEffect(() => {
    const element = canvas.current;
    const marks = overlay.current;
    if (element === null || marks === null) return;

    // A `mountGraph` that throws, and no WebGL context is the real case, subscribes nothing. The
    // caller would then keep the selection of the previous mount and draw what no canvas drew.
    onSelect(null);

    const handle = mountGraph(element, marks, corpus, layout, types);
    controller.current = handle;
    const unsubscribe = handle.subscribe((view) => {
      filterNow.current = view.filter;
      setSnapshot({ view, model: handle.model });
    });
    // It calls the listener at once with the selection this mount restored from the address, so
    // the caller needs no second seeding path.
    const stopSelecting = handle.onSelect(onSelect);

    return () => {
      unsubscribe();
      stopSelecting();
      handle.destroy();
      // A destroyed graph answers nothing, so the caller is told that it draws nothing.
      onSelect(null);
      // A cleanup of an older mount must not drop the handle of a newer mount.
      if (controller.current === handle) controller.current = null;
    };
  }, [corpus, types, layout, onSelect]);

  // The memo reads the values the rows are built from, and never the whole snapshot. A publish
  // makes a new snapshot object, and a fold is a publish. A memo that took the whole snapshot
  // would run `deriveRailRows` again: two walks and a sort, 20000 iterations at 10000 entities.
  const model = snapshot?.model ?? null;
  const filter = snapshot?.view.filter ?? null;
  const selection = snapshot?.view.selection ?? null;
  const railOpen = snapshot?.view.railOpen ?? false;
  const railWidth = snapshot?.view.railWidth ?? DEFAULT_GRAPH_WORKSPACE.railWidth;
  const openUnits = snapshot?.view.openUnits ?? null;
  const showUnplaced = snapshot?.view.showUnplaced ?? true;
  const counts = snapshot?.view.counts ?? null;

  const reach = useCallback((id: string) => {
    const handle = controller.current;
    if (handle === null) return;
    handle.focusOn(id);
  }, []);

  // Departure: the controller drops a selection the filter excludes, so the header offers none.
  // A node folded in the list stays, because a choice of it opens the units above it. The hubs
  // come first, and the name is the tie-break, as in the lists of the rail.
  const named = useMemo(() => {
    if (model === null || filter === null) return [];
    const hidden = new Set(filter.hiddenTypes);
    const shown: { id: string; label: string; degree: number }[] = [];
    model.graph.forEachNode((node, attrs) => {
      if (isShown(attrs, hidden, showUnplaced)) {
        shown.push({ id: node, label: attrs.label, degree: attrs.degree });
      }
    });
    return shown.sort((one, two) => two.degree - one.degree || one.label.localeCompare(two.label));
  }, [model, filter, showUnplaced]);

  // Departure: the filter narrows the rail and never the canvas, so the controller holds none of
  // it. `GraphCanvas` is memoised on two refs, so a new filter does not render the live element.
  const query = useScreenQuery({ named, choose: reach });

  const rows = useMemo(
    () =>
      model === null || filter === null || openUnits === null || counts === null
        ? null
        : deriveRailRows(
            model,
            { filter, counts, selection, openUnits, railOpen, railWidth },
            step,
            query,
          ),
    [model, filter, counts, selection, openUnits, railOpen, railWidth, step, query],
  );

  const act = useCallback((next: RailAct) => {
    const handle = controller.current;
    if (handle === null) return;
    switch (next.kind) {
      case 'open-rail':
        handle.setRailOpen(next.open);
        return;
      case 'resize-rail':
        handle.setRailWidth(next.width);
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
        setStep((held) => stepAfterTypeOpen(held, next.type, next.open));
        return;
    }
  }, []);

  const showWholeList = useCallback((type: string) => {
    setStep((held) => stepShowingWholeList(held, type));
  }, []);

  const showWholeGraph = useCallback(() => {
    controller.current?.showWholeGraph();
  }, []);

  const setHops = useCallback((hops: 1 | 2) => {
    controller.current?.setHops(hops);
  }, []);

  const expand = useCallback(() => {
    controller.current?.expand();
  }, []);

  const switchUnplaced = useCallback((show: boolean) => {
    controller.current?.setShowUnplaced(show);
  }, []);

  const openUnit = useCallback((unit: string, open: boolean) => {
    controller.current?.setUnitOpen(unit, open);
  }, []);

  return (
    <>
      {snapshot === null || snapshot.view.mode === 'start' ? null : (
        <ShownLine
          entities={snapshot.view.counts.entities}
          relations={snapshot.view.counts.relations}
        />
      )}
      <div
        className={cn(
          'dark grid border border-border bg-background text-foreground',
          'lg:grid-cols-[auto_minmax(0,1fr)_20rem]',
        )}
      >
        <div className={cn('relative h-96 min-w-0 lg:col-start-2 lg:row-start-1 lg:h-128')}>
          <GraphCanvas canvas={canvas} overlay={overlay} />
          {snapshot === null ? null : snapshot.view.mode === 'start' ? (
            <StartPanel named={named} onChoose={reach} onShowWholeGraph={showWholeGraph} />
          ) : snapshot.view.mode === 'focus' ? (
            <FocusBar
              hops={snapshot.view.hops}
              expandable={snapshot.view.expandable}
              onHops={setHops}
              onExpand={expand}
              onBack={showWholeGraph}
            />
          ) : null}
          <div className={cn('absolute top-2 right-2')}>
            {snapshot?.view.mode !== 'whole' ? null : (
              <button
                type="button"
                onClick={showWholeGraph}
                className={cn(
                  'h-6 border border-input bg-background px-2 text-xs text-foreground',
                  'transition-colors duration-100 hover:bg-muted',
                  'outline-none focus-visible:border-ring focus-visible:ring-3',
                  'focus-visible:ring-ring/50',
                )}
              >
                Show the whole graph
              </button>
            )}
          </div>
        </div>

        <div
          className={cn(
            'max-h-96 min-h-0 min-w-0 overflow-y-auto overscroll-contain border-t border-border',
            'lg:col-start-3 lg:row-start-1 lg:max-h-128 lg:border-t-0 lg:border-l',
          )}
        >
          {card}
        </div>

        {/* The rail is last in the order of the keys and of the screen when the island stacks, and
            the grid puts it first on a wide screen. */}
        <div
          className={cn(
            'max-h-96 min-h-0 overflow-hidden border-t border-border',
            'lg:col-start-1 lg:row-start-1 lg:max-h-128 lg:border-t-0 lg:border-r',
          )}
        >
          {snapshot === null || rows === null ? null : (
            <Rail
              rows={rows.rail}
              onAct={act}
              index={(type) => {
                const list = rows.lists.get(type);
                return list === undefined ? null : (
                  <IndexRows
                    list={list}
                    onSelect={reach}
                    onShowWholeList={() => {
                      showWholeList(type);
                    }}
                    onOpen={openUnit}
                  />
                );
              }}
              className={cn('h-full max-h-96 bg-background lg:max-h-128')}
            />
          )}
        </div>
      </div>

      {snapshot === null ? null : (
        <>
          <MarkerRemainder
            drawn={snapshot.view.markersDrawn}
            remainder={snapshot.view.markersOverCap}
          />
          <FocusNote
            drawn={snapshot.view.focusDrawn}
            unnamed={snapshot.view.focusUnnamed}
            unnamedRelations={snapshot.view.focusUnnamedRelations}
          />
          {snapshot.view.mode === 'whole' ? (
            <UnplacedCount
              unplaced={snapshot.view.unplaced}
              shown={snapshot.view.showUnplaced}
              onSwitch={switchUnplaced}
            />
          ) : null}
        </>
      )}
    </>
  );
}
