/**
 * PROTOTYPE — throwaway. The left rail, and the legend.
 *
 * **The rail is the same control as the map's.** `features/map/prototype-bar.ts` holds the
 * two-step rail the operator chose on 11 August 2026: the type rows and nothing else, one type
 * unfolded at a time, a field that appears only for the type that is open. The layer control and
 * the type filter are one control — the finding reported to **#36** — so this surface must not
 * invent a second one, and it does not.
 *
 * It is a copy and not an import, because ADR 0004 §5 refuses a feature that imports a feature.
 * Two throwaway prototypes may hold the same shape twice; the day one of them is folded in, the
 * shape is lifted to `shared/` once.
 *
 * **Three deliberate differences from the map, and the reason for each.**
 *
 * - *No colour dot beside a type.* On the map the hue **is** the encoding. Here the hue is the
 *   community, orange is a bridge and grey is an isolate, so a type swatch would state an
 *   encoding this canvas does not use. The count carries the weight instead.
 * - *The entity list is capped and the cap is on screen.* The map holds a corpus of tens; this
 *   holds ten thousand, and a rail that draws 2 500 rows is not a rail.
 * - *The list is ordered by degree, not by name.* On a graph the useful head of a list is the
 *   hubs. A name is reached by the field, which is what the field is for.
 */

import type { GraphController, GraphView } from './prototype-controller';
import { communityColour, CUT_POINT_COLOUR, ISOLATE_COLOUR } from './prototype-model';
import { button, el } from './prototype-dom';

// Theme rules 5 to 7 in `src/theme.css`: the radius is 0, a 1px hairline separates two surfaces,
// and there is no blur and no glass.
const CHIP = 'border px-2 py-0.5 text-xs font-medium transition-colors';
const CHIP_ON = `${CHIP} border-foreground bg-foreground text-background`;
const CHIP_OFF = `${CHIP} border-border bg-background text-muted-foreground hover:border-foreground`;

/** How many entity rows one unfolded type may draw. The remainder is stated, never hidden. */
const LIST_CAP = 60;

export type Repaint = (view: GraphView) => void;

export function mountRail(controller: GraphController, host: HTMLElement): Repaint {
  const model = controller.model;
  const graph = model.graph;

  const perType = new Map<string, number>();
  for (const entity of model.corpus.entities) {
    perType.set(entity.type, (perType.get(entity.type) ?? 0) + 1);
  }

  // Which type is unfolded. One at a time, so the rail never becomes the full list by accident.
  let expanded: string | null = null;
  const queries = new Map<string, string>();
  let view = controller.view();

  const render = (): void => {
    host.replaceChildren();
    const open = controller.railOpen();
    host.style.width = open ? '17rem' : '2.75rem';

    if (!open) {
      const strip = el('div', 'flex flex-col items-center');
      strip.append(
        button('»', 'w-full border-b border-border py-2 text-xs hover:bg-accent', () => {
          controller.setRailOpen(true);
        }),
      );
      const hidden = new Set(view.filter.hiddenTypes);
      for (const type of model.entityTypes) {
        const initial = button(
          type.slice(0, 1).toUpperCase(),
          `w-full py-1.5 text-[11px] hover:bg-accent ${hidden.has(type) ? 'opacity-50' : ''}`,
          () => {
            const next = new Set(hidden);
            if (next.has(type)) next.delete(type);
            else next.add(type);
            controller.setFilter({ hiddenTypes: [...next] });
          },
        );
        initial.title = type;
        strip.append(initial);
      }
      host.append(strip);
      return;
    }

    // ---- header ---------------------------------------------------------------------------
    const header = el('div', 'flex items-center gap-2 border-b border-border px-2 py-2');
    header.append(el('span', 'flex-1 text-xs font-medium', 'Layers'));
    header.append(
      button('«', 'px-1 text-xs text-muted-foreground hover:text-foreground', () => {
        controller.setRailOpen(false);
      }),
    );
    host.append(header);

    // ---- the type rows, and the one that is unfolded -----------------------------------------
    const list = el('div', 'min-h-0 flex-1 overflow-y-auto');
    const hidden = new Set(view.filter.hiddenTypes);

    for (const type of model.entityTypes) {
      const on = !hidden.has(type);
      const isOpen = expanded === type;

      const row = el(
        'div',
        `flex items-center gap-1.5 border-b border-border px-2 py-1.5 ${isOpen ? 'bg-muted' : ''} ${on ? '' : 'opacity-50'}`,
      );

      // Two targets on one row, and they are not the same act. The chevron opens the list; the
      // rest of the row switches the type off and on.
      const chevron = button(
        isOpen ? '▾' : '▸',
        'w-3.5 shrink-0 text-[11px] text-muted-foreground hover:text-foreground',
        () => {
          expanded = isOpen ? null : type;
          render();
        },
      );
      chevron.title = isOpen ? `Close the ${type} list` : `Open the ${type} list`;

      const label = button('', 'flex min-w-0 flex-1 items-center gap-2 text-left', () => {
        const next = new Set(hidden);
        if (on) next.add(type);
        else next.delete(type);
        controller.setFilter({ hiddenTypes: [...next] });
      });
      label.textContent = '';
      label.append(
        el('span', 'flex-1 truncate text-[11px] uppercase tracking-wider', type),
        el(
          'span',
          'shrink-0 font-mono text-[11px]',
          (perType.get(type) ?? 0).toLocaleString('en-GB'),
        ),
        el(
          'span',
          'w-6 shrink-0 text-right font-mono text-[11px] text-muted-foreground',
          on ? 'on' : 'off',
        ),
      );

      row.append(chevron, label);
      list.append(row);

      if (!isOpen || !on) continue;

      // The second step. A field appears only for the type that is open, because a filter over
      // one type is a different question from a filter over the corpus.
      const query = queries.get(type) ?? '';
      const search = document.createElement('input');
      search.className =
        'w-full border-b border-border bg-transparent px-2 py-1 pl-6 text-[11px] outline-none';
      search.placeholder = `Filter ${type}`;
      search.setAttribute('aria-label', `Filter ${type}`);
      search.value = query;
      search.addEventListener('input', () => {
        queries.set(type, search.value);
        render();
        // `render` rebuilds the field, so the caret has to be put back on the new node.
        const next = list.querySelector('input');
        if (next instanceof HTMLInputElement) {
          next.focus();
          next.setSelectionRange(next.value.length, next.value.length);
        }
      });
      list.append(search);

      const needle = query.trim().toLowerCase();
      const matches = model.corpus.entities
        .filter(
          (entity) =>
            entity.type === type &&
            (needle === '' || entity.label.toLowerCase().includes(needle)) &&
            graph.hasNode(entity.id),
        )
        .sort((a, b) => graph.degree(b.id) - graph.degree(a.id));

      for (const entity of matches.slice(0, LIST_CAP)) {
        const selected = view.selection !== null && view.selection.id === entity.id;
        const item = button(
          '',
          `flex w-full items-baseline justify-between gap-2 border-b border-border/60 py-1 pl-6 pr-2 text-left text-[11px] hover:bg-accent ${selected ? 'bg-accent font-medium' : ''}`,
          () => {
            controller.select({ kind: 'entity', id: entity.id });
            // A row of the rail asked for the move, so the camera may travel. A click on the
            // canvas still never moves it.
            controller.flyTo(entity.id);
          },
        );
        item.textContent = '';
        item.append(el('span', 'min-w-0 flex-1 truncate', entity.label));
        item.append(
          el('span', 'shrink-0 font-mono text-muted-foreground', String(graph.degree(entity.id))),
        );
        list.append(item);
      }

      if (matches.length > LIST_CAP) {
        list.append(
          el(
            'p',
            'py-1 pl-6 pr-2 text-[11px] text-muted-foreground',
            `+ ${(matches.length - LIST_CAP).toLocaleString('en-GB')} more. Use the field.`,
          ),
        );
      }
      if (matches.length === 0) {
        list.append(
          el('p', 'py-1 pl-6 pr-2 text-[11px] text-muted-foreground', 'Nothing matches.'),
        );
      }
    }
    host.append(list);

    // ---- the controls the map has no counterpart for -----------------------------------------
    const extras = el(
      'div',
      'flex flex-wrap items-center gap-1.5 border-t border-border px-2 py-2',
    );
    extras.append(
      button('pending only', view.filter.onlyProposed ? CHIP_ON : CHIP_OFF, () => {
        controller.setFilter({ onlyProposed: !controller.view().filter.onlyProposed });
      }),
    );
    extras.append(
      button('reset camera', CHIP_OFF, () => {
        controller.resetCamera();
      }),
    );

    const degreeWrap = el(
      'label',
      'flex w-full items-center gap-2 text-[11px] text-muted-foreground',
    );
    degreeWrap.append(el('span', 'tabular-nums', `degree ≥ ${view.filter.minDegree}`));
    const degree = document.createElement('input');
    degree.type = 'range';
    degree.min = '0';
    // Read from the data, never typed out.
    degree.max = String(Math.max(1, Math.min(model.structure.maxDegree, 20)));
    degree.step = '1';
    degree.value = String(view.filter.minDegree);
    degree.className = 'h-1 flex-1 accent-foreground';
    degree.addEventListener('input', () => {
      controller.setFilter({ minDegree: Number(degree.value) });
    });
    degreeWrap.append(degree);
    extras.append(degreeWrap);
    host.append(extras);

    // ---- footer -------------------------------------------------------------------------------
    host.append(
      el(
        'div',
        'truncate border-t border-border px-2 py-1.5 font-mono text-[11px] text-muted-foreground',
        view.selection === null ? 'No selection' : view.selection.id,
      ),
    );
  };

  render();

  return (next) => {
    const before = view;
    view = next;
    // A selection made on the canvas opens the group it belongs to, so the rail always agrees
    // with the graph about what is being examined.
    if (next.selection !== null && next.selection.kind === 'entity') {
      const entity = model.entityById.get(next.selection.id);
      if (entity !== undefined) expanded = entity.type;
    }
    // The badge counter republishes on a frame. Rebuilding the rail on every frame would take
    // the caret out of the field, so a repaint that changes nothing the rail draws is dropped.
    const same =
      before.selection?.id === next.selection?.id &&
      before.filter === next.filter &&
      before.filter.minDegree === next.filter.minDegree;
    if (same) return;
    render();
  };
}

function swatch(colour: string, label: string): HTMLElement {
  const row = el('span', 'flex items-center gap-1.5 text-[11px] text-muted-foreground');
  const dot = el('span', 'inline-block size-2.5 rounded-full');
  dot.style.background = colour;
  row.append(dot, el('span', '', label));
  return row;
}

/**
 * What the paint means, and how much of the picture is out of consideration.
 *
 * **The definitions fold away; the counts never do.** An encoding is learned once and then it is
 * noise, so it is on demand. A count is live, it changes with every filter, and an analyst who
 * cannot see how much is dimmed cannot trust what is lit. The two are not the same kind of
 * thing, and the toggle carries only the first.
 */
export function mountLegend(controller: GraphController, host: HTMLElement): Repaint {
  host.replaceChildren();

  const toggle = button(
    '',
    'flex w-full items-center gap-1.5 text-left text-[11px] font-medium',
    () => {
      controller.setLegendOpen(!controller.legendOpen());
    },
  );
  const caret = el('span', 'w-2.5 shrink-0 text-muted-foreground');
  const title = el('span', 'flex-1', 'Legend');
  toggle.textContent = '';
  toggle.append(caret, title);

  const body = el('div', 'mt-1 flex flex-col gap-1');
  body.append(
    swatch(communityColour(1), 'community'),
    swatch(CUT_POINT_COLOUR, 'bridge — a cut point that severs a real piece'),
    swatch(ISOLATE_COLOUR, 'isolate'),
  );
  const badge = el('span', 'flex items-center gap-1.5 text-[11px] text-muted-foreground');
  badge.append(
    el('span', 'inline-block size-2.5 rounded-full border-2 border-dashed border-amber-500'),
    el('span', '', 'pending proposal'),
  );
  body.append(badge);
  body.append(el('span', 'text-[11px] text-muted-foreground', 'size = degree'));

  const counts = el('div', 'mt-1 border-t border-border pt-1 text-[11px] tabular-nums');

  host.append(toggle, body, counts);

  return (view) => {
    const open = controller.legendOpen();
    caret.textContent = open ? '▾' : '▸';
    body.style.display = open ? 'flex' : 'none';
    toggle.title = open ? 'Fold the legend away' : 'What the colours mean';

    counts.textContent =
      `${view.lit.toLocaleString('en-GB')} lit · ${view.dimmed.toLocaleString('en-GB')} dimmed` +
      (view.badgesDrawn > 0 ? ` · ${view.badgesDrawn} badged` : '') +
      (view.badgesOverCap > 0 ? ` (${view.badgesOverCap} over the cap)` : '');
  };
}
