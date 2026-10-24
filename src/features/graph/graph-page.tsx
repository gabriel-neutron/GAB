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
import { useNarrowScreen } from '@/shared/narrow-screen';
import { askPanelFocus } from '@/shared/panel-focus';
import { Rail, type RailAct } from '@/shared/rail';
import { useScreenQuery } from '@/shared/screen-query';
import { SelectionPanel } from '@/shared/selection-panel';

import { mountGraph, type GraphController, type GraphView } from './controller';
import { FocusBar } from './focus-bar';
import { MarkerMeter } from './marker-meter';
import type { GraphModel } from './model';
import { deriveRailRows } from './rail-rows';
import { stepAfterTypeOpen, stepShowingWholeList, type RailStep } from './rail-step';
import { IndexRows } from './row';
import type { GraphSelection } from './selection';
import { everyTypeShown, hiddenAfterSwitch, isShown, type FilterState } from './type-filter';
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
      <div
        ref={overlay}
        className={cn('pointer-events-none absolute inset-0')}
        aria-hidden="true"
      />
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

/** The graph fills the work area. Its lists and selection share the site theme. */
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

  // Departure: on a phone the rail is a drawer over the canvas, closed at the start. The drawer
  // dies with the view. The stored fold of the rail is the choice of a wide screen, so the drawer
  // leaves it as it is.
  const narrow = useNarrowScreen();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const typesButton = useRef<HTMLButtonElement | null>(null);
  // A wide screen has no drawer, so the drawer is closed in the render that meets one.
  if (!narrow && drawerOpen) setDrawerOpen(false);

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
    askPanelFocus();
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

  // `GraphCanvas` is memoised on two refs, so a new filter does not render the live element.
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

  const act = useCallback(
    (next: RailAct) => {
      const handle = controller.current;
      if (handle === null) return;
      switch (next.kind) {
        case 'open-rail':
          if (narrow) setDrawerOpen(next.open);
          else handle.setRailOpen(next.open);
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
    },
    [narrow],
  );

  // A choice in the drawer ends the drawer, so the reader sees the node that was chosen.
  const reachFromDrawer = useCallback(
    (id: string) => {
      reach(id);
      setDrawerOpen(false);
    },
    [reach],
  );

  const clearSelection = useCallback(() => {
    controller.current?.clearSelection();
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

  const openUnit = useCallback((unit: string, open: boolean) => {
    controller.current?.setUnitOpen(unit, open);
  }, []);

  return (
    <div className="graph-workspace">
      <div
        // The drawer is absolute inside this island, so it is the positioned ancestor on a phone.
        // The key is read here, and not on the drawer, because focus may stay on the Types button.
        onKeyDown={(event) => {
          if (event.key === 'Escape') setDrawerOpen(false);
        }}
        className={cn(
          'graph-surface grid min-h-0 flex-1 bg-background text-foreground',
          selection === null
            ? 'md:grid-cols-[auto_minmax(0,1fr)]'
            : 'md:grid-cols-[auto_minmax(0,1fr)_20rem]',
        )}
      >
        <div className={cn('graph-canvas relative min-h-0 min-w-0 md:col-start-2 md:row-start-1')}>
          <GraphCanvas canvas={canvas} overlay={overlay} />
          {snapshot?.view.mode === 'focus' ? (
            <FocusBar
              hops={snapshot.view.hops}
              expandable={snapshot.view.expandable}
              onHops={setHops}
              onExpand={expand}
              onBack={showWholeGraph}
            />
          ) : null}
          {snapshot === null ? null : (
            <MarkerMeter drawn={snapshot.view.markersDrawn} hidden={snapshot.view.markersOverCap} />
          )}
          <button
            ref={typesButton}
            type="button"
            aria-expanded={drawerOpen}
            onClick={() => {
              setDrawerOpen(true);
            }}
            className={cn(
              'absolute bottom-2 left-2 z-10 h-6 border border-input bg-background px-2 text-small/4',
              'text-foreground transition-colors duration-100 hover:bg-muted md:hidden',
              'outline-none focus-visible:border-ring focus-visible:ring-3',
              'focus-visible:ring-ring/50',
            )}
          >
            Types
          </button>
        </div>

        <SelectionPanel
          shown={selection === null ? null : `${selection.kind}:${selection.id}`}
          onClose={clearSelection}
          fallback={narrow ? typesButton : undefined}
          className="md:col-start-3 md:row-start-1 md:border-l"
        >
          {card}
        </SelectionPanel>

        {/* The rail is last in the order of the keys and of the screen when the island stacks, and
            the grid puts it first on a wide screen. */}
        <div
          className={cn(
            'min-h-0 overflow-hidden border-border md:col-start-1 md:row-start-1 md:border-r',
            'max-md:absolute max-md:inset-y-0 max-md:left-0 max-md:z-20 max-md:w-72',
            'max-md:max-h-none max-md:max-w-[85%] max-md:border-t-0 max-md:border-r',
            'max-md:bg-background',
            drawerOpen ? null : 'max-md:hidden',
          )}
        >
          {snapshot === null || rows === null ? null : (
            <Rail
              rows={narrow ? { ...rows.rail, open: true } : rows.rail}
              onAct={act}
              index={(type) => {
                const list = rows.lists.get(type);
                return list === undefined ? null : (
                  <IndexRows
                    list={list}
                    onSelect={narrow ? reachFromDrawer : reach}
                    onShowWholeList={() => {
                      showWholeList(type);
                    }}
                    onOpen={openUnit}
                  />
                );
              }}
              className={cn('h-full bg-background')}
            />
          )}
        </div>
      </div>
    </div>
  );
}
