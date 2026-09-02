// The layer control that the map and the graph both draw. It owns the control and never the
// row: the map draws a name alone, the graph a name and a degree, so each caller passes its own
// list in. It derives nothing, holds no state, and reads no library and no `localStorage`.

import {
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/shared/lib/utils';

/** One type row of the first step. Every word of it is written by the caller's derivation. */
export interface RailTypeRow {
  readonly type: string;
  /** The one letter the folded strip draws where there is no colour. A strip fits no word. */
  readonly initial: string;
  /** How many entities of this type the surface draws now. */
  readonly count: number;
  /** Whether this type is in consideration. */
  readonly on: boolean;
  /** Whether the index of this type is unfolded. One type at a time. */
  readonly open: boolean;
  // One icon, two names: the map hides a layer and the graph dims one. A struck-out eye claims
  // the first on both, so the icon is hidden from a reader and these words carry the state.
  readonly stateWord: string;
  // The accessible name of the row in the folded strip, which has no room for the words beside
  // the count. The caller writes it, so a name never says "on the map" about a graph.
  readonly name: string;
  // A CSS custom property never reaches a map or a graph style parser, so this is a colour
  // value and no class can carry it. `null` where the surface paints no hue.
  readonly colour: string | null;
}

export interface RailRows {
  readonly types: readonly RailTypeRow[];
  // More than one type may stand unfolded, so an analyst reads two lists beside each other.
  readonly openTypes: readonly string[];
  /** A control that can exclude everything says so, and carries the way back. */
  readonly everyTypeOff: boolean;
  /** Whether the rail shows its index. The workspace holds it. */
  readonly open: boolean;
}

// A closed set, so no caller can build an act this control cannot make. Each act says what
// happened and never what the store should become: a single act that carried a whole set would
// put the polarity of one surface into a control that both surfaces use.
export type RailAct =
  | { readonly kind: 'open-rail'; readonly open: boolean }
  | { readonly kind: 'switch-type'; readonly type: string; readonly on: boolean }
  // It names the type and the state it asked for, as `switch-type` does, because more than one
  // may stand open.
  | { readonly kind: 'open-type'; readonly type: string; readonly open: boolean }
  | { readonly kind: 'show-every-type' };

export interface RailProps {
  /** Every row the rail draws. The caller's derivation sorted, counted and worded each one. */
  readonly rows: RailRows;
  readonly onAct: (act: RailAct) => void;
  // A function of the type and not of one node: more than one type may stand unfolded, so this
  // control asks the caller for each list it has room to draw and holds none of its own.
  readonly index: (type: string) => ReactNode;
  // The map rail is a solid column beside the canvas and the graph rail floats over it. A
  // shared file takes `className` exactly where two callers differ, and this is that case.
  readonly className?: string;
}

/** The region one fold control opens. One type, one region. */
const listId = (type: string): string => `rail-index-${type}`;

// `ring` on its own paints at rest and paints `currentcolor`, so the three focus utilities stay
// together, and the border is transparent and one pixel because `focus-visible:border-ring`
// paints nothing without a width. `pointer-events-auto` gives a drag on the graph rail back.
const CONTROL = cn(
  'pointer-events-auto flex h-6 items-center border border-transparent text-left',
  'transition-colors duration-100 hover:bg-muted',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** A column of figures lines up, and it does not jump as a digit is added. */
const FIGURE = 'shrink-0 font-mono tabular-nums';

interface SwatchProps {
  readonly colour: string;
  readonly on: boolean;
}

// The hue is never the only mark, so the state is written in words beside this swatch. Where
// the hue is not the encoding the caller sends `null` and the initial takes this place.
function Swatch({ colour, on }: SwatchProps) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: colour }}
      className={cn('size-2 shrink-0', on ? null : 'opacity-40')}
    />
  );
}

export function Rail({ rows, onAct, index, className }: RailProps) {
  const { open } = rows;

  return (
    <aside
      aria-label="Layers"
      // One hairline separates two surfaces, and `border` is that token: `input` is the edge of a
      // control. The caller states the ground, the width and any hairline of its own.
      className={cn('flex flex-col text-xs', className)}
    >
      <div className="flex h-6 shrink-0 items-center gap-1 px-1.5">
        {open ? (
          <span className="min-w-0 flex-1 truncate text-small/4 tracking-caps text-label uppercase">
            Layers
          </span>
        ) : null}
        {/* An icon-only control carries an `aria-label`. The label says the act, and
            `aria-expanded` says the state. */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close the rail' : 'Open the rail'}
          onClick={() => {
            onAct({ kind: 'open-rail', open: !open });
          }}
          className={cn(CONTROL, 'shrink-0 justify-center px-1')}
        >
          {open ? (
            <PanelLeftClose size={14} aria-hidden="true" />
          ) : (
            <PanelLeftOpen size={14} aria-hidden="true" />
          )}
        </button>
      </div>

      {/* A control that can exclude everything carries the way back. A prototype reached an
          all-grey screen, and the filter is stored, so that screen survived a reload. The sentence
          says the state, and the button restores the stored default of the caller. */}
      {open && rows.everyTypeOff ? (
        <div className="flex shrink-0 flex-col gap-1 border-b border-border p-2">
          <p className="text-label">Every type is off. The surface draws none of the corpus.</p>
          <button
            type="button"
            data-every-type-off=""
            onClick={() => {
              onAct({ kind: 'show-every-type' });
            }}
            className={cn(CONTROL, 'w-full justify-center border-input')}
          >
            Switch every type on
          </button>
        </div>
      ) : null}

      <div className="pointer-events-auto min-h-0 flex-1 overflow-y-auto">
        {/* The one `.map` of this file. It turns an already-derived array into elements, and the
            two states of the control are two shapes of one entry — never two designs of the layer
            panel, which is the fault the tracker names. */}
        {rows.types.map((row) => (
          <div key={row.type} data-facet={row.type}>
            {open ? (
              <div className="flex h-6 items-center gap-1 px-1.5">
                {/* Two targets on one row. The chevron names the region it opens only while
                    that region exists: a closed row that named it sent a reader to an element
                    that is not in the tree. */}
                <button
                  type="button"
                  aria-expanded={row.open}
                  aria-controls={row.open ? listId(row.type) : undefined}
                  aria-label={row.open ? `Close the ${row.type} list` : `Open the ${row.type} list`}
                  onClick={() => {
                    onAct({ kind: 'open-type', type: row.type, open: !row.open });
                  }}
                  className={cn(CONTROL, 'size-6 shrink-0 justify-center')}
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
                  className={cn(CONTROL, 'min-w-0 flex-1 gap-1.5')}
                >
                  {row.colour === null ? null : <Swatch colour={row.colour} on={row.on} />}
                  <span className="min-w-0 flex-1 truncate" title={row.type}>
                    {row.type}
                  </span>
                  {/* The count carries on the graph the weight a colour carries on the map. */}
                  <span className={cn(FIGURE, 'text-muted-foreground')}>{row.count}</span>
                  {/* The glyph is hidden from a reader: one icon cannot say "hidden" on the
                      map and "dimmed" on the graph, so these words carry the state. */}
                  <span className="sr-only">{row.stateWord}</span>
                  {row.on ? (
                    <Eye size={14} aria-hidden="true" className="shrink-0 text-label" />
                  ) : (
                    <EyeOff size={14} aria-hidden="true" className="shrink-0 text-label" />
                  )}
                </button>
              </div>
            ) : (
              /* The strip is a control and not a caption: a click on a colour still switches
                 the type. It has no room for the word, so the name the caller wrote carries
                 the state instead. */
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
                  <span aria-hidden="true">{row.initial}</span>
                ) : (
                  <Swatch colour={row.colour} on={row.on} />
                )}
                <span className={cn(FIGURE, 'min-w-0 truncate text-small/4')}>{row.count}</span>
              </button>
            )}

            {/* The second step: the index of the type that is unfolded.

                A type that is switched off has no index: the surface draws none of it. */}
            {open && row.open && row.on ? (
              <div id={listId(row.type)} className="px-1.5 pb-1">
                {index(row.type)}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </aside>
  );
}
