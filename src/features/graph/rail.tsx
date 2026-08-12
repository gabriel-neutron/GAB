/**
 * The layer control of the graph, on the left — the **two-step rail**.
 *
 * Built from `docs/graph-surface.md` §4.4, §5.1, §5.2, §5.5 and §8 step 5. `./rail-rows` computes
 * every row it draws.
 *
 * **Why this file is here, and not in `shared/`.** §8 step 5 says "lift the map's rail into
 * `shared/`". The skill is exact — "A shape moves to `shared/` at its second call site, never at
 * its first" — and a rail written in `shared/` before the second caller exists is a shared
 * component designed against a surface that nobody has built.
 *
 * **`src/features/map/rail.tsx` is in the tree today, so the second call site now exists and the
 * lift of step 5 is no longer blocked.** It was written after this file, and this sentence said
 * that it was absent. The lift takes both files at one time: it belongs to whoever owns the two,
 * with both callers in front of the author, and it is not the work of a fix inside one feature.
 * A feature never imports a feature (ADR 0001 §1), so until that day the two rails stay two
 * files, and §4.4 keeps the three differences between them with a reason for each.
 *
 * **It is a sibling of the canvas, and it holds no state at all.** `CANVAS.md` permits React state
 * in a sibling, and `./graph-page` holds the two values that die with the view: which type is
 * unfolded, and the text in the field. They are held there because `./rail-rows` needs both to
 * derive the rows, and a value in two stores is the fault ADR 0004 §7 names. The camera, the
 * filter and `railOpen` are not React values anywhere: the `controller` of §4.3 and
 * `./workspace` own them.
 *
 * **It takes no `GraphController`.** A component that holds the handle cannot be mounted with
 * plain values, and a component that cannot be storied has the wrong seam.
 *
 * **No colour beside a type** — §4.4. On the map the hue is the encoding; here the hue is the
 * community, so a type colour would state an encoding this canvas does not use. `./rail-rows`
 * carries the reason for this and for the other two differences from the map.
 */

import { ChevronDown, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';

import type { RailRows } from './rail-rows';

/**
 * What the analyst did on the rail. **A closed set of four cases**, so no caller can build an act
 * that this control cannot make, and no case can be forgotten by the caller.
 *
 * `hide-types` carries the whole hidden set, in the polarity of §5.2, because `./rail-rows`
 * computed it: the set that a switch produces is a derivation, and this file makes none.
 */
export type RailAct =
  | { readonly kind: 'hide-types'; readonly hiddenTypes: readonly string[] }
  | { readonly kind: 'open-type'; readonly type: string | null }
  | { readonly kind: 'change-query'; readonly query: string }
  | { readonly kind: 'select-entity'; readonly id: string };

export interface RailProps {
  /** Every row the rail draws. `./rail-rows` sorted, capped and counted each one. */
  readonly rows: RailRows;
  /** Whether the rail is unfolded. The workspace holds it — ADR 0004 §7 and §5.4. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAct: (act: RailAct) => void;
}

/** The region the chevron of a type row opens. One surface draws one rail. */
const LIST_ID = 'graph-rail-list';

/** The focus ring of the kit, exactly. A border width is stated, or `border-ring` paints nothing. */
const RING =
  'border border-transparent outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

/** One line that acts. It is a real control, so it reaches the keyboard and the reader. */
const LINE = 'pointer-events-auto flex h-6 w-full items-center gap-1 rounded-none px-1 text-left';

/** A column of figures — one right edge, and no jump as a digit is added. */
const FIGURE = 'shrink-0 font-mono text-right tabular-nums';

export function Rail({ rows, open, onOpenChange, onAct }: RailProps) {
  // §5.5: a panel that floats over the canvas takes no pointer event on its own padding, so a drag
  // that starts there still moves the graph below it. Each control below takes the pointer back.
  if (!open) {
    return (
      <div
        className={cn(
          'pointer-events-none flex w-11 flex-col rounded-none border bg-popover',
          'text-xs text-popover-foreground',
        )}
      >
        <button
          type="button"
          aria-label="Open the layer rail"
          aria-expanded={false}
          onClick={() => {
            onOpenChange(true);
          }}
          className={cn(LINE, RING, 'justify-center border-b duration-100 hover:bg-muted')}
        >
          <ChevronsRight size={14} aria-hidden="true" />
        </button>

        {/* §4.4 of the map: the folded strip keeps the switches and the counts. There is no type
            colour on this surface, so the strip carries the initial and the count. */}
        {rows.types.map((row) => (
          <button
            key={row.type}
            type="button"
            title={row.type}
            aria-pressed={row.on}
            // The strip has room for one letter, so the state of the type reaches a reader
            // through the name of the control — §4.4, "a type switches off, and the count beside
            // it says so".
            aria-label={row.on ? `${row.type}, on` : `${row.type}, off and dimmed`}
            onClick={() => {
              onAct({ kind: 'hide-types', hiddenTypes: row.hiddenWhenToggled });
            }}
            className={cn(
              LINE,
              RING,
              'justify-between duration-100 hover:bg-muted',
              row.on ? '' : 'text-muted-foreground line-through',
            )}
          >
            <span aria-hidden="true">{row.initial}</span>
            <span className={cn(FIGURE, 'text-label')}>{row.count}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'pointer-events-none flex max-h-full w-64 flex-col rounded-none border bg-popover',
        'text-xs text-popover-foreground',
      )}
    >
      <div className={cn('flex h-6 shrink-0 items-center gap-1 border-b px-1')}>
        <span className={cn('min-w-0 flex-1 truncate')}>Layers</span>
        <button
          type="button"
          aria-label="Fold the layer rail"
          aria-expanded={true}
          onClick={() => {
            onOpenChange(false);
          }}
          className={cn(
            'pointer-events-auto flex size-6 items-center justify-center rounded-none',
            RING,
            'duration-100 hover:bg-muted',
          )}
        >
          <ChevronsLeft size={14} aria-hidden="true" />
        </button>
      </div>

      {/* §5.2: a control that can exclude everything carries the way back. The prototype reached
          an all-grey screen, and the filter is stored, so that screen survived a reload. The
          sentence says the state, and the button restores the stored default of `./workspace`. */}
      {rows.everyTypeOff ? (
        <div className={cn('flex shrink-0 flex-col gap-1 border-b p-2')}>
          <p className={cn('text-label')}>Every type is off. The whole graph is dimmed.</p>
          <button
            type="button"
            onClick={() => {
              onAct({ kind: 'hide-types', hiddenTypes: rows.hiddenWhenEveryTypeShown });
            }}
            className={cn(LINE, RING, 'justify-center border duration-100 hover:bg-muted')}
          >
            Switch every type on
          </button>
        </div>
      ) : null}

      <ul className={cn('pointer-events-auto min-h-0 flex-1 overflow-y-auto')}>
        {rows.types.map((row) => (
          <li key={row.type} className={cn('border-b')}>
            {/* Two targets on one row, and they are not the same act. The chevron opens the
                list of the type; the rest of the row switches the type off and on.

                The chevron names the region it opens **only while that region exists**. The list
                is in the tree for the row that is open and for no other, so a closed row that
                named `LIST_ID` sent a reader to an element that is not there. */}
            <div className={cn('flex h-6 items-center', row.on ? '' : 'text-muted-foreground')}>
              <button
                type="button"
                aria-expanded={row.open}
                aria-controls={row.open ? LIST_ID : undefined}
                aria-label={row.open ? `Close the ${row.type} list` : `Open the ${row.type} list`}
                onClick={() => {
                  onAct({ kind: 'open-type', type: row.open ? null : row.type });
                }}
                className={cn(
                  'pointer-events-auto flex size-6 shrink-0 items-center justify-center',
                  'rounded-none',
                  RING,
                  'duration-100 hover:bg-muted',
                )}
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
                  onAct({ kind: 'hide-types', hiddenTypes: row.hiddenWhenToggled });
                }}
                className={cn(LINE, RING, 'min-w-0 flex-1 gap-2 duration-100 hover:bg-muted')}
              >
                <span className={cn('min-w-0 flex-1 truncate')} title={row.type}>
                  {row.type}
                </span>
                {/* The count carries the weight that a colour carries on the map — §4.4. */}
                <span className={cn(FIGURE)}>{row.count}</span>
                {/* §4.4, "Works when": a type switches off, and **the count beside it says so**.
                    The count is honest and it does not change, because §5.2 dims and never
                    hides. So the row states the consequence in words. The line-through said it
                    to a reader who sees the strike, and to nobody else. */}
                <span className={cn('shrink-0 text-right text-label')}>
                  {row.on ? 'on' : 'off, dimmed'}
                </span>
              </button>
            </div>

            {/* The second step. The field belongs to the type that is open, because a filter over
                one type is a different question from a filter over the corpus. §9 keeps search
                across the corpus with W9, and this field is not that capability. */}
            {rows.open?.type !== row.type ? null : (
              <div id={LIST_ID} className={cn('flex flex-col border-t bg-muted/30 pl-6')}>
                <Input
                  className={cn('pointer-events-auto h-6 rounded-none text-xs')}
                  aria-label={`Filter ${row.type} by name`}
                  placeholder={`Filter ${row.type}`}
                  value={rows.open.query}
                  onChange={(event) => {
                    onAct({ kind: 'change-query', query: event.target.value });
                  }}
                />

                {rows.open.entities.map((entity) => (
                  <button
                    key={entity.id}
                    type="button"
                    aria-current={entity.selected ? 'true' : undefined}
                    onClick={() => {
                      onAct({ kind: 'select-entity', id: entity.id });
                    }}
                    className={cn(
                      LINE,
                      RING,
                      'gap-2 duration-100',
                      entity.selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted',
                    )}
                  >
                    <span className={cn('min-w-0 flex-1 truncate')} title={entity.label}>
                      {entity.label}
                    </span>
                    <span className={cn(FIGURE, 'text-label')}>{entity.degree}</span>
                  </button>
                ))}

                {/* §4.4: the list is capped, and **the remainder is on the screen**. A surface
                    that drops rows in silence is worse than one that says how many it dropped. */}
                {rows.open.remainder === 0 ? null : (
                  <p className={cn('flex h-6 items-center px-1 text-label')}>
                    {rows.open.remainder} more. Use the field.
                  </p>
                )}

                {rows.open.entities.length === 0 ? (
                  <p className={cn('flex h-6 items-center px-1 text-label')}>
                    No name matches. This type has {row.count} entities.
                  </p>
                ) : null}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
