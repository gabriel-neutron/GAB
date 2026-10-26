// Departure: the map and the graph draw different rows, so each caller passes its own list in.
// This control derives nothing, reads no `localStorage`, and holds only the width of a live drag.

import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import {
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

import { EntityGlyph } from '@/shared/entity-glyph';
import { cn } from '@/shared/lib/utils';
import { RAIL_WIDTH, railWidthWithin } from '@/shared/rail-width';

export interface RailTypeRow {
  readonly type: string;
  /** The human label of the type. The key stays the identity of the row. */
  readonly label: string;
  /** Departure: the folded strip fits no word, so it draws this letter where no colour is. */
  readonly initial: string;
  readonly count: number;
  // Departure: the wide row shows these words, and the strip shows the count alone. The caller
  // states whether the count is a part of a whole, so the words say what the figure means.
  readonly figure: string;
  readonly on: boolean;
  readonly open: boolean;
  // Departure: the map hides a layer and the graph dims one, and a struck-out eye claims the
  // first on both. So the icon is hidden from a reader, and these words carry the state.
  readonly stateWord: string;
  // Departure: the folded strip has no room for the words beside the count. The caller writes
  // this name, so a name never says "on the map" about a graph.
  readonly name: string;
  // External constraint: a CSS custom property never reaches a map or a graph style parser, so
  // this is a colour value and no class can carry it. `null` where the surface paints no hue.
  readonly colour: string | null;
}

export interface RailLinksRow {
  readonly on: boolean;
  readonly label: string;
  /** Departure: the name says the state as well, because the strip has no room for a word. */
  readonly name: string;
}

export interface RailRows {
  readonly types: readonly RailTypeRow[];
  /** Departure: `null` where the surface draws no relation line, so it gets no control. */
  readonly links: RailLinksRow | null;
  // Departure: more than one type may stand unfolded, so an analyst reads two lists side by side.
  readonly openTypes: readonly string[];
  readonly everyTypeOff: boolean;
  readonly open: boolean;
  readonly width: number;
}

// Departure: each act says what happened and never what the store becomes. An act that carried
// a whole set would put the polarity of one surface into a control that both surfaces use.
export type RailAct =
  | { readonly kind: 'open-rail'; readonly open: boolean }
  | { readonly kind: 'switch-type'; readonly type: string; readonly on: boolean }
  | { readonly kind: 'switch-links'; readonly on: boolean }
  // Departure: a drag says its width once, at its end, so a store takes one write per drag.
  | { readonly kind: 'resize-rail'; readonly width: number }
  // Departure: it names the type and the state, as `switch-type` does, because more than one
  // type may stand open.
  | { readonly kind: 'open-type'; readonly type: string; readonly open: boolean }
  | { readonly kind: 'show-every-type' };

interface RailProps {
  readonly rows: RailRows;
  readonly onAct: (act: RailAct) => void;
  // Departure: a function of the type and not one node. More than one type may stand unfolded,
  // so this control asks the caller for each list it has room for, and holds none of its own.
  readonly index: (type: string) => ReactNode;
  // Departure: the map rail is a solid column beside the canvas, and the graph rail floats over
  // it. A shared file takes `className` exactly where two callers differ.
  readonly className?: string;
}

const listId = (type: string): string => `rail-index-${type}`;

// External constraint: `ring` alone paints at rest in `currentcolor`, and a border ring paints
// nothing without a width. `pointer-events-auto` gives a drag on the graph rail back.
const CONTROL = cn(
  'pointer-events-auto flex min-h-8 items-center rounded-none text-left',
  'transition-colors duration-150 hover:bg-surface-secondary',
  'outline-none focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring',
);

/** External constraint: proportional digits jump as a digit is added, and these do not. */
const FIGURE = 'shrink-0 font-mono text-data tabular-nums';

const CAPTION = 'font-mono text-caption uppercase text-label';

interface MarkProps {
  readonly type: string;
  /** Departure: an off row keeps its mark at full colour, so the reader still sees what they hid. */
  readonly colour: string;
}

// Departure: the hue is never the only mark, so the shape of the type and words beside it carry
// the state. `colour` is kept for the callers that pass it; the glyph reads the `entity-*` token.
function Mark({ type }: MarkProps) {
  return <EntityGlyph type={type} />;
}

// The 14px box of the design system. Decoration: the state is the `aria-pressed` of the button.
function Toggle({ on }: { readonly on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-3.5 shrink-0 place-items-center rounded-sm border',
        on ? 'border-foreground bg-foreground' : 'border-input',
      )}
    >
      {on ? (
        <span className="mb-px h-[3px] w-1.5 -rotate-45 border-b-[1.5px] border-l-[1.5px] border-background" />
      ) : null}
    </span>
  );
}

// Origin: one arrow key moves the edge by 16px, four steps of the grid, so a keyboard crosses the
// whole range in about twenty presses.
const KEY_STEP = 16;

interface ResizeEdgeProps {
  readonly width: number;
  readonly onDrag: (width: number | null) => void;
  readonly onAct: (act: RailAct) => void;
}

// External constraint: the pointer capture keeps each move on this edge while the pointer is over
// a canvas, and a canvas that took the moves would pan under the drag.
function ResizeEdge({ width, onDrag, onAct }: ResizeEdgeProps) {
  const start = useRef<{ readonly x: number; readonly width: number } | null>(null);
  const last = useRef(width);

  const widthAt = (event: PointerEvent<HTMLDivElement>): number | null =>
    start.current === null
      ? null
      : railWidthWithin(start.current.width + event.clientX - start.current.x);

  const stop = (event: PointerEvent<HTMLDivElement>): void => {
    const next = widthAt(event);
    // Departure: `width` already tracks the live drag, so it near-always equals `next` here and
    // the write would be skipped. The width the drag started from is the one to compare against.
    const before = start.current?.width ?? null;
    start.current = null;
    onDrag(null);
    if (next !== null && next !== before) onAct({ kind: 'resize-rail', width: next });
  };

  const step = (event: KeyboardEvent<HTMLDivElement>): void => {
    const by = event.key === 'ArrowLeft' ? -KEY_STEP : event.key === 'ArrowRight' ? KEY_STEP : 0;
    if (by === 0) return;
    event.preventDefault();
    const next = railWidthWithin(width + by);
    if (next !== width) onAct({ kind: 'resize-rail', width: next });
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Rail width"
      aria-valuenow={width}
      aria-valuemin={RAIL_WIDTH.min}
      aria-valuemax={RAIL_WIDTH.max}
      tabIndex={0}
      data-rail-edge=""
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        start.current = { x: event.clientX, width };
        last.current = width;
      }}
      onPointerMove={(event) => {
        const next = widthAt(event);
        if (next === null || next === last.current) return;
        last.current = next;
        onDrag(next);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onKeyDown={step}
      className={cn(
        'pointer-events-auto absolute inset-y-0 -right-1 z-10 w-2 cursor-col-resize touch-none',
        'max-lg:hidden',
        'transition-colors duration-150 hover:bg-ring',
        'outline-none focus-visible:bg-ring',
      )}
    />
  );
}

export function Rail({ rows, onAct, index, className }: RailProps) {
  const { open, links } = rows;
  const [dragged, setDragged] = useState<number | null>(null);
  const width = dragged ?? railWidthWithin(rows.width);
  // External constraint: a class cannot hold a number that changes, so the width is a custom
  // property that a class reads. The rail takes the whole row where the caller stacks it.
  const style: CSSProperties & Record<'--rail-width', string> = {
    '--rail-width': `${String(width)}px`,
  };

  return (
    <aside
      aria-label="Types"
      // Departure: the caller states the ground and any hairline of its own, and the rail states
      // its width, so both callers clamp the stored width in one place.
      style={open ? style : undefined}
      className={cn(
        'relative flex flex-col text-body-sm',
        open ? 'w-full lg:w-(--rail-width)' : 'w-11',
        className,
      )}
    >
      {open ? <ResizeEdge width={width} onDrag={setDragged} onAct={onAct} /> : null}
      <div className="flex h-8 shrink-0 items-center gap-2 border-b border-divider px-3">
        {open ? <span className={cn(CAPTION, 'min-w-0 flex-1')}>Types</span> : null}
        {/* External constraint: an icon-only control has no name without `aria-label`. The
            label says the act, and `aria-expanded` says the state. */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close the rail' : 'Open the rail'}
          onClick={() => {
            onAct({ kind: 'open-rail', open: !open });
          }}
          className={cn(CONTROL, 'size-6 min-h-6 shrink-0 justify-center rounded-sm')}
        >
          {open ? (
            <PanelLeftClose size={14} aria-hidden="true" />
          ) : (
            <PanelLeftOpen size={14} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* Departure: the master control of the lines sits over the types, because it outranks
          each one of them. */}
      {links === null ? null : (
        <button
          type="button"
          aria-pressed={links.on}
          aria-label={links.name}
          title={links.name}
          onClick={() => {
            onAct({ kind: 'switch-links', on: !links.on });
          }}
          className={cn(
            CONTROL,
            'shrink-0 border-b border-divider',
            open ? 'gap-2 px-3' : 'justify-center px-1',
          )}
        >
          <Toggle on={links.on} />
          {open ? (
            <span
              className={cn(
                'min-w-0 flex-1 py-0.5 break-words',
                links.on ? null : 'text-muted-foreground',
              )}
            >
              {links.label}
            </span>
          ) : null}
        </button>
      )}

      {/* Departure: the filter is stored, so a screen with every type off survives a reload.
          So the control that can exclude everything carries the way back to the default. */}
      {open && rows.everyTypeOff ? (
        <div className="flex shrink-0 flex-col gap-2 border-b border-divider p-3">
          <p className="text-muted-foreground">
            Every type is off. The surface draws none of the corpus.
          </p>
          <button
            type="button"
            data-every-type-off=""
            onClick={() => {
              onAct({ kind: 'show-every-type' });
            }}
            className={cn(CONTROL, 'w-full justify-center rounded-sm border border-input')}
          >
            Switch every type on
          </button>
        </div>
      ) : null}

      <div className="pointer-events-auto min-h-0 flex-1 overflow-y-auto">
        {/* Departure: the open rail and the strip are two shapes of one entry, and never two
            designs of the layer panel. */}
        {rows.types.map((row) => (
          <div key={row.type} data-facet={row.type}>
            {open ? (
              <div className="flex min-h-8 items-center gap-1 border-b border-divider pr-3 pl-1">
                {/* External constraint: `aria-controls` must name an element in the tree, so
                    the chevron names its region only while that region is drawn: it is open and its type is on. */}
                <button
                  type="button"
                  aria-expanded={row.open}
                  aria-controls={row.open && row.on ? listId(row.type) : undefined}
                  aria-label={
                    row.open ? `Close the ${row.label} list` : `Open the ${row.label} list`
                  }
                  onClick={() => {
                    onAct({ kind: 'open-type', type: row.type, open: !row.open });
                  }}
                  className={cn(CONTROL, 'size-6 min-h-6 shrink-0 justify-center rounded-sm')}
                >
                  {row.open ? (
                    <ChevronDown size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  aria-pressed={row.on}
                  onClick={() => {
                    onAct({ kind: 'switch-type', type: row.type, on: !row.on });
                  }}
                  className={cn(CONTROL, 'min-w-0 flex-1 gap-2 px-1')}
                >
                  <Toggle on={row.on} />
                  {row.colour === null ? null : <Mark type={row.type} colour={row.colour} />}
                  <span
                    className={cn(
                      'min-w-0 flex-1 py-0.5 break-words',
                      row.on ? null : 'text-muted-foreground',
                    )}
                  >
                    {row.label}
                  </span>
                  {/* Departure: the count carries on the graph the weight a hue carries on the
                      map. */}
                  <span className={cn(FIGURE, 'text-muted-foreground')}>{row.figure}</span>
                  {/* Departure: a glyph alone does not say the state of a switch, so the
                      words carry it. */}
                  <span className="sr-only">{row.stateWord}</span>
                </button>
              </div>
            ) : (
              /* Departure: the strip is a control and not a caption, so a click on a colour
                 still switches the type, and the name the caller wrote carries the state. */
              <button
                type="button"
                aria-pressed={row.on}
                aria-label={row.name}
                title={row.name}
                onClick={() => {
                  onAct({ kind: 'switch-type', type: row.type, on: !row.on });
                }}
                className={cn(CONTROL, 'w-full justify-center gap-1 px-1')}
              >
                {row.colour === null ? (
                  // External constraint: axe counts every visible character as the label, and the
                  // name carries the type and the count. The initial is drawn by CSS, so it is
                  // not in the tree.
                  <span
                    aria-hidden="true"
                    data-initial={row.initial}
                    className="before:content-[attr(data-initial)]"
                  />
                ) : (
                  <Mark type={row.type} colour={row.colour} />
                )}
                <span className={cn(FIGURE, 'min-w-0 truncate text-small/4')}>{row.count}</span>
              </button>
            )}

            {/* Departure: a type that is switched off has no index, because the surface draws
                none of it. */}
            {open && row.open && row.on ? (
              <div id={listId(row.type)} className="px-3 pb-2">
                {index(row.type)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
}
