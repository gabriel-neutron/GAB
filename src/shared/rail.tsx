/**
 * The two-step rail — the layer control that the map and the graph both draw.
 *
 * Built from `docs/map-surface.md` §4.5, `docs/graph-surface.md` §4.4 and §5.2, and step 5 of
 * `docs/graph-surface.md` §8, which asks for one design on two surfaces.
 *
 * **Two throwaway prototypes may hold one shape twice; three call sites may not.** The map wrote
 * this control first and the graph wrote it again. This file is the lift, and the two callers are
 * `src/features/map/rail.tsx` and `src/features/graph/graph-page.tsx`.
 *
 * **It separates two acts.** Switching a type is a control and it is always at hand. Reading the
 * entities of one type is asked for, with the chevron. That is the whole of the two steps.
 *
 * **The search field of the first build is gone** — #82 rows C6 and C9, and the empty-result line
 * with it. The operator does not want a search inside this rail. A search across the corpus is a
 * capability of its own, and **#90 GLOBAL-SEARCH** holds it. So the second step draws the whole
 * list of the open type, and this file carries no text and no `change-query` act.
 *
 * **It owns the control, and never the row.** The list of entities under an open type is not the
 * same thing on the two surfaces: the map draws a name alone — #81 B6 took its one column of
 * values off — and the graph draws a name and a degree, capped, with the remainder on the
 * screen. `docs/graph-surface.md` §4.4 calls this rail "the same
 * **control** as the map's", and the row has its own entry in `docs/map-surface.md` §4.6. So the
 * caller passes its list in, and this file states nothing about a row.
 *
 * **It derives nothing and it holds no state.** Every row arrives ready, and every act goes back to
 * the caller as one of a closed set. The caller owns the store, so the polarity of §5.2 — the
 * workspace holds the types that are **off** — stays in one place on each surface and never here.
 *
 * **It reads no library and no `localStorage`.** It is a sibling of a live canvas and never an
 * ancestor of one, so `CANVAS.md` permits the caller to hold ordinary React state beside it.
 *
 * **Three differences the graph needs, and this file carries all three in data** —
 * `docs/graph-surface.md` §4.4. No colour beside a type, because there the hue is the community and
 * not the type: `colour` is `null` and the initial takes the place of the swatch. The list is
 * capped and the remainder is on the screen: that is the caller's list. The list is in the order of
 * the degree: that is the caller's list as well.
 */

import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
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
  /**
   * What being off means on this surface, in words. The map hides a layer and says `off`; the
   * graph dims one and says `off, dimmed`. **The consequence is a fact of the surface**, so the
   * derivation writes it and this file never chooses between the two.
   */
  readonly stateWord: string;
  /**
   * The accessible name of the row in the folded strip, which has no room for the words beside
   * the count. The caller writes it, so each surface keeps its own voice and a name never says
   * "on the map" about a graph.
   */
  readonly name: string;
  /**
   * The hue of the legend, as the canvas parses it, or `null` where the hue is not the encoding.
   * A CSS custom property never reaches a map or a graph style parser, so this is a colour value
   * and no class can carry it.
   */
  readonly colour: string | null;
}

export interface RailRows {
  readonly types: readonly RailTypeRow[];
  /** The type that is unfolded, or `null` at the first step. */
  readonly openType: string | null;
  /** §5.2: a control that can exclude everything says so, and carries the way back. */
  readonly everyTypeOff: boolean;
  /** Whether the rail shows its index. The workspace holds it — ADR 0004. */
  readonly open: boolean;
}

/**
 * What the analyst did on the rail. **A closed set**, so no caller can build an act this control
 * cannot make, and no case can be forgotten.
 *
 * **Each act says what happened, and never what the store should become.** `switch-type` carries
 * the type and the state the analyst asked for. The map answers it with one call of its handle,
 * and the graph answers it with a new hidden set. A single act that carried a whole set would put
 * the polarity of one surface into a control that both surfaces use.
 */
export type RailAct =
  | { readonly kind: 'open-rail'; readonly open: boolean }
  | { readonly kind: 'switch-type'; readonly type: string; readonly on: boolean }
  | { readonly kind: 'open-type'; readonly type: string | null }
  | { readonly kind: 'show-every-type' };

export interface RailProps {
  /** Every row the rail draws. The caller's derivation sorted, counted and worded each one. */
  readonly rows: RailRows;
  readonly onAct: (act: RailAct) => void;
  /**
   * The list of entities of the open type. The caller draws it, because a row is not the same
   * component on the two surfaces — see the header.
   */
  readonly index: ReactNode;
  /** What the surface pins below the list. The map puts its relations and its counts here. */
  readonly footer: ReactNode;
  /**
   * The ground and the width, which the two callers state differently: the map rail is a solid
   * column beside the canvas, and the graph rail floats over it (`docs/graph-surface.md` §5.5).
   * The Placement rule of the `component` skill allows a shared file to take `className` exactly
   * where two callers differ, and this is that case.
   */
  readonly className?: string;
}

/** The region one fold control opens. One type, one region. */
const listId = (type: string): string => `rail-index-${type}`;

/**
 * The recipe of every control here: one row at the control height, the focus ring of the kit
 * exactly, and a state change under 120ms.
 *
 * `ring` on its own paints at rest and paints `currentcolor`, so the three focus utilities stay
 * together. The border is transparent and one pixel wide, because `focus-visible:border-ring`
 * paints nothing without a border width.
 *
 * **`pointer-events-auto` is on every control, and it is not decoration.** The graph rail floats
 * over its canvas and takes no pointer event on its own padding, so that a drag which starts there
 * still moves the graph below. Each control takes the pointer back. On the map, where the shell
 * takes its events, this class changes nothing.
 */
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

/**
 * The colour swatch of one type.
 *
 * **It is the documented exception on the map, and it is absent on the graph.** The entity hues
 * stay on the canvas and out of the chrome, and the legend is the one place that keeps them: a
 * coloured point means nothing without it. Where the hue is not the encoding the caller sends
 * `null`, and the initial takes this place.
 *
 * The state is written in words beside it, so the switch never rests on colour alone.
 */
function Swatch({ colour, on }: SwatchProps) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: colour }}
      className={cn('size-2 shrink-0', on ? null : 'opacity-40')}
    />
  );
}

export function Rail({ rows, onAct, index, footer, className }: RailProps) {
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
          <span className="min-w-0 flex-1 truncate text-[11px]/4 tracking-[0.06em] text-label uppercase">
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

      {/* §5.2: a control that can exclude everything carries the way back. A prototype reached an
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
            panel, which is the fault #36 names. */}
        {rows.types.map((row) => (
          <div key={row.type} data-facet={row.type}>
            {open ? (
              <div className="flex h-6 items-center gap-1 px-1.5">
                {/* **Two targets on one row, and they are not the same act.** The chevron unfolds
                    the index; the rest of the row switches the type. The chevron names the region
                    it opens **only while that region exists**: a closed row that named the region
                    sent a reader to an element that is not in the tree. */}
                <button
                  type="button"
                  aria-expanded={row.open}
                  aria-controls={row.open ? listId(row.type) : undefined}
                  aria-label={row.open ? `Close the ${row.type} list` : `Open the ${row.type} list`}
                  onClick={() => {
                    onAct({ kind: 'open-type', type: row.open ? null : row.type });
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
                  {/* The count carries on the graph the weight that a colour carries on the map. */}
                  <span className={cn(FIGURE, 'text-muted-foreground')}>{row.count}</span>
                  {/* "Works when": a type switches off, and **the count beside it says so**. The
                      count is honest and it does not change where the surface dims, so the row
                      states the consequence in words. A line through the text said it to a reader
                      who sees the strike, and to nobody else. */}
                  <span className="shrink-0 text-right text-label">{row.stateWord}</span>
                </button>
              </div>
            ) : (
              /* The strip is a control and not a caption: a click on a colour still switches the
                 type. The count stays beside it, so the folded rail still says what is drawn.

                 **The name carries the state.** The open rail writes the word beside the count.
                 The strip has no room for it, so the name says it instead, and the caller wrote
                 that name. */
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
                <span className={cn(FIGURE, 'min-w-0 truncate text-[11px]/4')}>{row.count}</span>
              </button>
            )}

            {/* The second step: the index of the type that is unfolded.

                **The field of the first build is gone** — #82 rows C6 and C9. The operator does
                not want a search inside this rail. A search across the corpus is a capability of
                its own, and **#90 GLOBAL-SEARCH** holds it. A type that is switched off has no
                index: the surface draws none of it. */}
            {open && row.open && row.on ? (
              <div id={listId(row.type)} className="px-1.5 pb-1">
                {index}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* **The footer is drawn in both states, and that is a rule and not a choice.**
          `docs/map-surface.md` §4.5 keeps the switches and the counts in the folded strip and
          loses **only the list**. A footer that vanished with the fold would drop the count of
          what cannot be drawn, which is the one number §3.3 puts on the screen in words. The
          caller owns the two shapes of its own footer. */}
      {footer}
    </aside>
  );
}
