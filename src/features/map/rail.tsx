/**
 * The layer control and the index, on the left of the map.
 *
 * Built from `docs/map-surface.md` §4.5 and §8 step 6, with the findings §3.1 and the rules §5.1,
 * §5.2, §5.4 and §5.5.
 *
 * **The two-step rail.** The entity types first, one type unfolded at a time, and a field that
 * appears only for the type that is open. Switching a type is a control and it is always at hand;
 * finding an entity is a search, and it is asked for.
 *
 * **This is one control, and not two** — §3.1. Four items survive the layer panel: an entry per
 * entity type, a colour, a count and visibility. That is the same control as the type filter, so
 * nothing here draws a presentation setting: no opacity, no reorder, no rename and no colour
 * picker. #36 names a second design of the layer panel as the fault.
 *
 * **The closed state keeps the legend.** A bar that closes to nothing turns every colour on the
 * map into a guess. Only the list is lost, so the strip keeps the colours, the counts and the
 * switches — the four type switches, the relations switch, and each count of the two footers. A
 * sentence does not fit in 44px, so a count there shows its number and says its words to the
 * reader through an accessible name.
 *
 * **It drives the map through the handle, and it touches no library** — §4.2. `adapter.ts` is the
 * only writer of `hiddenTypes`, so a switch here is a call of `setTypeVisible` and never a write
 * of the workspace. `whenStyleReady` inside the adapter absorbs the window while the style loads,
 * so a control of this file can be clicked at any moment.
 *
 * **The open state of the rail arrives as a prop** — ADR 0004 §7 puts it in the workspace, and
 * `map-page.tsx` owns that read and that patch. A component that reads `localStorage` cannot be
 * storied, and `docs/graph-surface.md` §4.5 settled the same shape for the legend of the graph.
 *
 * **It derives nothing.** `projection.ts` holds `railLegend` and `entitiesMatching`, and this file
 * turns one already-derived array into elements.
 *
 * **M9 stays in `row.tsx`.** The blank cell and the header that names the key belong to one line
 * of the index, and this file does not restate them.
 *
 * **The relations have one switch of their own, outside the type list** — §4.7 and §8 step 8. ADR
 * 0005 §6 keeps the type list a projection of the entity types, so a relation never enters it. The
 * switch calls `setLinksVisible`, and `adapter.ts` stays the only writer of `linksHidden`.
 *
 * **Its count says what the map draws now** — §5.1. `railLegend` counts a relation as drawn when
 * the map draws both of its endpoints, so a type that goes off lowers this number with the entity
 * count below it. The count of the corpus that no map can draw is a different number, and it
 * stays where §3.3 puts it.
 *
 * **The list of the relations of the selected entity is here, and no card is** — §4.7 refuses the
 * card of the prototype until the operator says who owns a relation surface, and §7 holds that
 * question open with no ticket. So a row names the way the relation points, the relation type and
 * the other endpoint, and choosing that row selects that endpoint. **The relation the analyst
 * chose on the map is named on one line, in the same words.** No row and no line carries an
 * interval, an attribute or a source document. **No interval is written anywhere on this
 * surface**, so M6 cannot be broken at one end only.
 */

import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeftOpen, Waypoints } from 'lucide-react';
import { useEffect, useState, type RefObject } from 'react';

import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';

import type { MapHandle } from './adapter';
import {
  entitiesMatching,
  linksOfSelection,
  railLegend,
  type GeoLink,
  type Projection,
} from './projection';
import { IndexRows } from './row';

export interface RailProps {
  /** The corpus, reduced to what a map can draw. `./projection` makes it. */
  readonly projection: Projection;
  /**
   * The live map, in the ref that the caller holds. Every act of this rail goes through it, and
   * never through the library.
   *
   * **The instance arrives in a ref, and never in React state above the canvas** — `CANVAS.md`
   * names "the instance in React state above the live element" as the fault the ADR names. The
   * caller renders this rail only after its mount effect fills the ref, so `current` holds the
   * live map for the whole life of this component.
   */
  readonly map: RefObject<MapHandle | null>;
  /** Whether the rail shows the index. The workspace holds it — ADR 0004 §7. */
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * Which type is unfolded. It dies with the view, so it is React state — `CANVAS.md` makes the
 * rail a sibling of the canvas.
 *
 * **The two cases are not one nullable value.** Until the analyst folds a type open, the rail
 * follows the selection of the map: a rail that only listened opened no group on a reload (§5.1).
 * After the first fold the choice of the analyst holds, and `null` then means "the analyst closed
 * every group", which the selection must not undo.
 */
type OpenType =
  | { readonly kind: 'follows-selection' }
  | { readonly kind: 'chosen'; readonly type: string | null };

/** The identifier of the region one fold control opens. One type, one region. */
const listId = (type: string): string => `map-rail-index-${type}`;

/**
 * The recipe of every control here: one row of 24px, no radius, the focus ring of the kit exactly,
 * and a state change under 120ms. `ring` on its own paints at rest and paints `currentcolor`, so
 * the three focus utilities stay together. The border is transparent and one pixel wide, because
 * `focus-visible:border-ring` paints nothing without a border width.
 */
const CONTROL = cn(
  'flex h-6 items-center rounded-none border border-transparent text-left',
  'transition-colors duration-100 hover:bg-muted',
  'outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
);

/** A column of figures lines up — rule 13. */
const FIGURE = 'shrink-0 font-mono tabular-nums';

/**
 * How the rail shows the two directions of a relation.
 *
 * The mark is for the eye and it is hidden from the reader, because an arrow has no name that a
 * reader can say. The word carries the same fact into the accessible name of the row.
 */
const DIRECTION_MARK = { out: '→', in: '←' } as const;
const DIRECTION_WORD = { out: 'to', in: 'from' } as const;

/**
 * The one word for a state of this rail. **The two switches carry two polarities**: the store
 * holds the types that are **hidden** (§5.2), and the relations state holds what is **shown**. A
 * call site that wrote the two words itself flipped them between the two forms. Each caller
 * therefore states what is **on**, and this function chooses the word.
 */
const stateWord = (on: boolean): string => (on ? 'on' : 'off');

/** The same rule for the eye. The caller states what is on, and this states how it looks. */
const dimmed = (on: boolean): string | null => (on ? null : 'opacity-40');

interface SwatchProps {
  /** The hex the map parses. `TypeFacet.colour` gives it. */
  readonly colour: string;
  /** Whether the map draws this type now. */
  readonly drawn: boolean;
}

/**
 * The colour swatch of one type.
 *
 * **It is the documented exception, and it is not a fault.** §5.5 rule 11 "keeps the entity hues
 * on the map and out of the chrome". §3.1 and §4.5 keep "A colour swatch per entry — It is the
 * legend. A coloured point means nothing without it." So this one hue stays in the chrome. Do not
 * remove it.
 *
 * The hue comes from `TypeFacet.colour`, which is the hex the map parses, so no Tailwind class can
 * carry it. The state is written in words beside it, so the switch never rests on colour alone.
 */
function Swatch({ colour, drawn }: SwatchProps) {
  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: colour }}
      className={cn('size-2 shrink-0 rounded-none', dimmed(drawn))}
    />
  );
}

interface CountLineProps {
  readonly count: number;
  /** What the number counts, as it reads after the number. **One source for the sentence.** */
  readonly sentence: string;
  /** The `data-` attribute that names this line. A story reads the line by it. */
  readonly attribute: string;
  /** Whether the rail shows its index. The closed state is the 44px strip. */
  readonly open: boolean;
}

/**
 * One count of a footer, in the two shapes of §4.5.
 *
 * **The count that cannot be drawn is on the screen, in words** — §3.3. A surface that drops
 * evidence in silence is worse than one that says how much it dropped.
 *
 * **The strip carries a number, and it says the words to the reader.** §4.5 keeps the counts in the
 * closed state and loses the list alone. A sentence does not fit in 44px, so the number stays on
 * the screen and the same sentence reaches the reader and the pointer.
 *
 * Three lines took this shape, and two of them held two copies of one sentence. The two copies had
 * already drifted, so each sentence lives here one time.
 */
function CountLine({ count, sentence, attribute, open }: CountLineProps) {
  const says = `${count}${sentence}`;
  const mark: Record<string, number> = { [attribute]: count };
  return open ? (
    <p {...mark} className="text-label">
      <span data-count="" className={cn(FIGURE, 'text-foreground')}>
        {count}
      </span>
      {sentence}
    </p>
  ) : (
    <p {...mark} title={says} className="flex h-6 items-center justify-center text-label">
      <span className="sr-only">{says}</span>
      <span
        data-count=""
        aria-hidden="true"
        className={cn(FIGURE, 'text-[11px]/4 text-foreground')}
      >
        {count}
      </span>
    </p>
  );
}

export function Rail({ projection, map, open, onOpenChange }: RailProps) {
  /**
   * The legend, as the map holds it at this moment. It is seeded from the handle and it is taken
   * from the handle again after each switch, so the adapter stays the one truth and this state is
   * an echo of it that dies with the view.
   *
   * The caller mounts this rail after the map exists, so the ref is full at each read below. The
   * fallback states what a rail with no map draws — everything on — and it invents no setting.
   */
  const [legend, setLegend] = useState(() =>
    railLegend(projection, (type) => map.current?.isTypeVisible(type) ?? true),
  );

  /**
   * **Seed from the current selection, then subscribe** — §5.1. The seed is here, and the
   * subscription below is the same read: `handle.onSelect` calls its listener at once with the
   * selection of that moment, so there is no second path and no window between the two.
   */
  const [selected, setSelected] = useState<string | null>(map.current?.selected ?? null);

  /**
   * Whether the map draws the relations. It is an echo of the handle, exactly like the legend
   * above: the adapter holds `linksHidden` and this state dies with the view.
   */
  const [linksShown, setLinksShown] = useState(() => map.current?.linksVisible ?? true);

  /**
   * The relation the analyst chose on the map, as the handle holds it. It is an echo again, and
   * `adapter.ts` states why the choice lives in its closure: it dies with the view.
   */
  const [chosen, setChosen] = useState<GeoLink | null>(map.current?.chosenLink ?? null);

  const [openType, setOpenType] = useState<OpenType>({ kind: 'follows-selection' });

  /** The text of the search field. It dies with the view, and a new fold clears it. */
  const [query, setQuery] = useState('');

  // The one effect of this file, and it is a subscription. It returns the unsubscribe of the
  // handle, so a rail that leaves the screen drives no dead map. The ref is stable, so this list
  // holds for the whole life of the rail. Each subscription seeds itself, so the two states above
  // need no second read.
  useEffect(() => {
    const live = map.current;
    if (live === null) return;
    const stopSelect = live.onSelect(setSelected);
    const stopChoose = live.onChooseLink(setChosen);
    return () => {
      stopSelect();
      stopChoose();
    };
  }, [map]);

  const selectedType = selected === null ? null : (projection.byId.get(selected)?.type ?? null);
  const shownType = openType.kind === 'follows-selection' ? selectedType : openType.type;

  /**
   * **The switch goes through the one writer** — §4.4 and §5.2. This rail writes no workspace
   * field. The adapter stores the types that are switched off, drops a selection that the switch
   * would leave undrawn, and answers `isTypeVisible` after the write.
   */
  const switchType = (type: string, visible: boolean): void => {
    const live = map.current;
    if (live === null) return;
    live.setTypeVisible(type, visible);
    setLegend(railLegend(projection, live.isTypeVisible));
  };

  /** The same rule for the relations: one call of the handle, and no write of the workspace. */
  const switchLinks = (visible: boolean): void => {
    const live = map.current;
    if (live === null) return;
    live.setLinksVisible(visible);
    setLinksShown(live.linksVisible);
  };

  const foldType = (type: string): void => {
    setOpenType({ kind: 'chosen', type: shownType === type ? null : type });
    setQuery('');
  };

  /** A row selects an entity and moves the camera to it — §4.5. */
  const reach = (id: string): void => {
    const live = map.current;
    if (live === null) return;
    live.select(id);
    live.flyTo(id);
  };

  /**
   * The relations of the selected entity, already derived. `projection.ts` names the other
   * endpoint of each one, and this file turns the array into elements.
   *
   * **The visibility comes from the legend of this render, and not from the handle.** A call of
   * `isTypeVisible` is not a React value, so a switch would change the map and leave this list
   * as it was. The legend is the echo that a switch writes, so the list and the map agree at each
   * render: a relation whose other endpoint is not drawn is no row here. `railLegend` fills
   * `drawnTypes` in the walk it already makes, so this file derives nothing.
   */
  const linkRows = linksOfSelection(projection, selected, (type) => legend.drawnTypes.has(type));

  /**
   * The name of the relations switch in the strip. **The name carries the state**, because 44px
   * has no room for the word beside the count. `CountLine` holds the sentence of each count.
   *
   * **The number is what the map draws now**, and it falls with a type switch: a relation needs
   * both of its endpoints on the map. A count of the corpus here named lines that no layer drew.
   */
  const relationsSays = `relations, ${legend.drawnLinks} ${stateWord(linksShown)} the map`;

  return (
    <aside
      aria-label="Layers"
      // One hairline separates two surfaces, and `border` is that token: `input` is the edge of a
      // control. The width is part of the contract — 240px open, and a 44px strip closed.
      className={cn(
        'flex shrink-0 flex-col border-r border-border bg-background text-xs',
        open ? 'w-60' : 'w-11',
      )}
    >
      <div className="flex h-6 shrink-0 items-center gap-1 px-1.5">
        {open ? (
          <span className="min-w-0 flex-1 truncate text-[11px]/4 tracking-[0.06em] text-label uppercase">
            Layers
          </span>
        ) : null}
        {/* An icon-only control carries an `aria-label` — `src/shared/mode-toggle.tsx` is the
            model. The label says the act, and `aria-expanded` says the state. */}
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Close the rail' : 'Open the rail'}
          onClick={() => {
            onOpenChange(!open);
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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* The one `.map` of this file. `railLegend` derived the array, and this turns it into
            elements. The two states of the control are two shapes of one entry, and never two
            designs of the layer panel — §3.1. */}
        {legend.facets.map(({ facet, hidden }) => (
          <div key={facet.type} data-facet={facet.type}>
            {open ? (
              <div className="flex h-6 items-center gap-1 px-1.5">
                {/* **Two targets on one row, and they are not the same act.** The chevron folds
                    the index open; the label switches the type. §4.5 separates the two. */}
                <button
                  type="button"
                  aria-expanded={shownType === facet.type}
                  aria-controls={listId(facet.type)}
                  aria-label={`Index of ${facet.type}`}
                  onClick={() => {
                    foldType(facet.type);
                  }}
                  className={cn(CONTROL, 'shrink-0')}
                >
                  {shownType === facet.type ? (
                    <ChevronDown size={14} aria-hidden="true" />
                  ) : (
                    <ChevronRight size={14} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  aria-pressed={!hidden}
                  onClick={() => {
                    switchType(facet.type, hidden);
                  }}
                  className={cn(CONTROL, 'min-w-0 flex-1 gap-1.5')}
                >
                  <Swatch colour={facet.colour} drawn={!hidden} />
                  <span className="min-w-0 flex-1 truncate" title={facet.type}>
                    {facet.type}
                  </span>
                  <span className={cn(FIGURE, 'text-muted-foreground')}>{facet.count}</span>
                  <span className="w-6 shrink-0 text-right text-label">{stateWord(!hidden)}</span>
                </button>
              </div>
            ) : (
              /* The strip is a control and not a caption: a click on a colour still switches the
                 type. The count stays beside it, so the closed rail still says what is drawn.

                 **The name carries the state.** The open rail writes `on` or `off` in words
                 beside the count. The strip has no room for that word, so the name says it
                 instead. A name that says `on the map` for a type that is off is a false
                 report to a reader who cannot see the opacity. */
              <button
                type="button"
                aria-pressed={!hidden}
                aria-label={`${facet.type}, ${facet.count} ${stateWord(!hidden)} the map`}
                title={`${facet.type} — ${facet.count} ${stateWord(!hidden)} the map`}
                onClick={() => {
                  switchType(facet.type, hidden);
                }}
                className={cn(CONTROL, 'w-full justify-center gap-1 px-1')}
              >
                <Swatch colour={facet.colour} drawn={!hidden} />
                <span className={cn(FIGURE, 'min-w-0 truncate text-[11px]/4')}>{facet.count}</span>
              </button>
            )}

            {/* The second step. The field appears only for the type that is open, and a type that
                is switched off has no index: the map draws none of it. */}
            {open && shownType === facet.type && !hidden ? (
              <div id={listId(facet.type)} className="px-1.5 pb-1">
                <Input
                  className="h-6 rounded-none text-xs"
                  aria-label={`Search ${facet.type} by name`}
                  placeholder="Search by name"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                  }}
                />
                <IndexRows
                  facet={facet}
                  entities={entitiesMatching(projection, facet.type, query)}
                  selectedId={selected}
                  onSelect={reach}
                />
              </div>
            ) : null}
          </div>
        ))}
      </div>

      {/* **The relations, with one switch of their own** — §4.7. They are not an entity type, so
          ADR 0005 §6 keeps them out of the list above. The switch is the same shape as a type
          switch, and it carries no colour: a line takes no entity hue.

          **The switch and the count stay in the closed state** — §4.5: the strip keeps the
          colours, the counts and the switches, and **only the list is lost**. A sentence does not
          fit in 44px, so the strip shows the number and says the words to the reader. */}
      <div className="shrink-0 border-t border-border px-1.5 py-1">
        {open ? (
          <button
            type="button"
            data-relations=""
            aria-pressed={linksShown}
            onClick={() => {
              switchLinks(!linksShown);
            }}
            className={cn(CONTROL, 'w-full gap-1.5')}
          >
            <span className="min-w-0 flex-1 truncate">relations</span>
            <span data-count="" className={cn(FIGURE, 'text-muted-foreground')}>
              {legend.drawnLinks}
            </span>
            <span className="w-6 shrink-0 text-right text-label">{stateWord(linksShown)}</span>
          </button>
        ) : (
          /* The strip carries the same act. The glyph stands for a relation, and it takes no
             entity hue; the state is in `aria-pressed` and in the opacity, and never in a hue. */
          <button
            type="button"
            data-relations=""
            aria-pressed={linksShown}
            aria-label={relationsSays}
            title={relationsSays}
            onClick={() => {
              switchLinks(!linksShown);
            }}
            className={cn(CONTROL, 'w-full justify-center gap-1 px-1')}
          >
            <Waypoints
              size={14}
              aria-hidden="true"
              className={cn('shrink-0', dimmed(linksShown))}
            />
            <span data-count="" className={cn(FIGURE, 'min-w-0 truncate text-[11px]/4')}>
              {legend.drawnLinks}
            </span>
          </button>
        )}

        {open ? (
          <>
            {/* **A click on a line names that relation here, and it opens no card** — §4.7 and
                §7. The map brightens the line and this one row says which relation it is: the
                type and its two endpoints, in the order the corpus states them. **It carries no
                interval, no attribute and no source document.** Those three are the card that §7
                has no owner for, and M6 cannot be broken at one end where no end is written.

                The choice dies with the view. `adapter.ts` holds it, and this state is an echo.
                A list is lost in the strip, and this one line is a list of one, so it goes with
                the list above. */}
            {chosen === null ? null : (
              <p
                data-chosen-link={chosen.id}
                className="flex h-6 items-center gap-1.5 px-1 text-label"
              >
                <span className="min-w-0 flex-1 truncate text-foreground">
                  <span title={chosen.from.label}>{chosen.from.label}</span>
                  <span aria-hidden="true">{' → '}</span>
                  <span className="sr-only">{' to '}</span>
                  <span title={chosen.to.label}>{chosen.to.label}</span>
                </span>
                <span className="min-w-0 max-w-20 truncate" title={chosen.type}>
                  {chosen.type}
                </span>
              </p>
            )}

            {/* **Selecting an entity lists its relations** — §4.7. The map brightens them, and
                this list names them: the way each one points, its type, and the **other**
                endpoint. Choosing a row selects that endpoint, which is how the endpoints move
                the selection. The interval and the source documents belong to a relation surface
                that nobody owns yet — §7 — so no row carries either one.

                **A relation whose other endpoint is not drawn is no row here.** `projection.ts`
                drops it, and the count in the line above is the length of what is left. */}
            {selected === null ? null : linkRows.length === 0 ? (
              <p className="text-label" data-no-links="">
                The selected entity touches none that can be drawn.
              </p>
            ) : (
              <div data-links={linkRows.length}>
                <p className="text-label">
                  <span data-count="" className={cn(FIGURE, 'text-foreground')}>
                    {linkRows.length}
                  </span>
                  {' on the selected entity'}
                </p>
                {/* Four rows of 24px, and the rest scrolls. The list sits under the index, and a
                    long list must not take the whole rail from it. */}
                <div className="max-h-24 overflow-y-auto">
                  {/* The one `.map` of this block. It is keyed by the identity of the relation. */}
                  {linkRows.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      data-link-row=""
                      // The name says the relation, the way it points and the other endpoint. The
                      // arrow beside it is hidden from the reader, because it has no name to say.
                      aria-label={`${row.type} ${DIRECTION_WORD[row.direction]} ${row.other.label}`}
                      onClick={() => {
                        reach(row.other.id);
                      }}
                      className={cn(CONTROL, 'w-full gap-1.5 px-1')}
                    >
                      {/* **A row of a relation carries no hue** — §3.1 and rule 11 of §5.5. The
                          swatch is the legend, and a legend entry is a type. Grey at rest, and
                          the row says the entity and the relation type in words. */}
                      <span aria-hidden="true" className="shrink-0 text-label">
                        {DIRECTION_MARK[row.direction]}
                      </span>
                      <span className="min-w-0 flex-1 truncate" title={row.other.label}>
                        {row.other.label}
                      </span>
                      <span className="min-w-0 max-w-20 truncate text-label" title={row.type}>
                        {row.type}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* **The count that cannot be drawn is on the screen** — §3.3 and §4.7. M4 permits a
            relation to point at a relation, and such a relation has no second point. The number
            counts one relation at a time — `projection.ts` — and the sentence says only what one
            number can carry: each of them has an endpoint that this map draws nowhere.

            The sentence stays while the switch is off: what the corpus drops is a fact of the
            corpus, and it is not a result of the switch. In the strip the number stays and the
            sentence goes to the reader, because 44px carries no sentence.

            **This number does not follow the type switches, and that is correct.** §3.3 counts it
            in the corpus: an endpoint is a relation (M4), or an endpoint carries no geometry. A
            type that goes off changes what is drawn, and it changes no fact of the corpus. The
            switch of the relations answers with `legend.drawnLinks`, which is the view count. Do
            not make this one follow the filter. */}
        {projection.undrawableLinks === 0 ? null : (
          <CountLine
            count={projection.undrawableLinks}
            sentence=" more relations cannot be drawn here. Each one has an endpoint that this map draws nowhere."
            attribute="data-undrawable-links"
            open={open}
          />
        )}
      </div>

      {/* **The count that cannot be drawn is on the screen, in words** — §3.3. A surface that
          drops evidence in silence is worse than one that says how much it dropped. The first
          line answers the switch: a type that goes off lowers what is drawn, and the corpus
          count beside each type says what the corpus still holds.

          **The counts stay in the closed state** — §4.5 loses only the list. A sentence does not
          fit in 44px, so the strip keeps the number on the screen and gives the words to the
          reader, through an accessible name that says what the number counts. */}
      <div className="shrink-0 border-t border-border px-1.5 py-1 text-label">
        <CountLine
          count={legend.drawn}
          sentence={` of ${projection.entities.length} entities drawn`}
          attribute="data-drawn"
          open={open}
        />
        {projection.undrawableEntities === 0 ? null : (
          <CountLine
            count={projection.undrawableEntities}
            sentence=" more carry no geometry. They cannot be drawn here."
            attribute="data-undrawable"
            open={open}
          />
        )}
      </div>
    </aside>
  );
}
