/**
 * PROTOTYPE — throwaway. The controls, as DOM.
 *
 * The three variants disagree about where these sit and what leads. They agree about what a
 * control does, so the behaviour lives here once and the placement lives in each variant.
 */

import type { GraphController, GraphView } from './prototype-controller';
import { communityColour, CUT_POINT_COLOUR, ISOLATE_COLOUR } from './prototype-model';
import { button, el } from './prototype-dom';

const CHIP = 'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors';
const CHIP_ON = `${CHIP} border-foreground bg-foreground text-background`;
const CHIP_OFF = `${CHIP} border-border bg-background text-muted-foreground hover:border-foreground`;

export type Repaint = (view: GraphView) => void;

/**
 * The filter row. Every control here dims and never hides, and no control moves a position.
 * UC4, and the reason a stored position can be filter-independent.
 */
export function buildFilters(controller: GraphController, host: HTMLElement): Repaint {
  const model = controller.model;
  host.replaceChildren();

  const chips = new Map<string, HTMLButtonElement>();
  for (const type of model.entityTypes) {
    const chip = button(type, CHIP_OFF, () => {
      const current = new Set(controller.view().filter.types);
      if (current.has(type)) current.delete(type);
      else current.add(type);
      controller.setFilter({ types: [...current] });
    });
    chips.set(type, chip);
    host.append(chip);
  }

  const proposed = button('pending only', CHIP_OFF, () => {
    controller.setFilter({ onlyProposed: !controller.view().filter.onlyProposed });
  });
  host.append(proposed);

  const degreeWrap = el('label', 'flex items-center gap-2 text-xs text-muted-foreground');
  const degreeText = el('span', 'tabular-nums', 'degree ≥ 0');
  const degree = document.createElement('input');
  degree.type = 'range';
  degree.min = '0';
  degree.max = '12';
  degree.step = '1';
  degree.className = 'h-1 w-24 accent-foreground';
  degree.addEventListener('input', () => {
    controller.setFilter({ minDegree: Number(degree.value) });
  });
  degreeWrap.append(degreeText, degree);
  host.append(degreeWrap);

  // The five rows of the fixture are lost among ten thousand invented ones. This is how a
  // reviewer reaches them, and how the M4 relation of the sample is reached at all.
  const fixture = model.corpus.entities.find(
    (entity) => model.corpus.realEntityIds.has(entity.id) && model.hiddenByEndpoint.has(entity.id),
  );
  if (fixture !== undefined) {
    host.append(
      button('go to the fixture', `${CHIP_OFF} border-amber-500 text-amber-600`, () => {
        controller.select({ kind: 'entity', id: fixture.id });
        controller.flyTo(fixture.id);
      }),
    );
  }

  host.append(
    button('reset camera', `${CHIP_OFF} ml-auto`, () => {
      controller.resetCamera();
    }),
  );

  return (view) => {
    const allowed = new Set(view.filter.types);
    for (const [type, chip] of chips) chip.className = allowed.has(type) ? CHIP_ON : CHIP_OFF;
    proposed.className = view.filter.onlyProposed ? CHIP_ON : CHIP_OFF;
    degree.value = String(view.filter.minDegree);
    degreeText.textContent = `degree ≥ ${view.filter.minDegree}`;
  };
}

function swatch(colour: string, label: string): HTMLElement {
  const row = el('span', 'flex items-center gap-1.5 text-[11px] text-muted-foreground');
  const dot = el('span', 'inline-block size-2.5 rounded-full');
  dot.style.background = colour;
  row.append(dot, el('span', '', label));
  return row;
}

/** What the paint means. Three encodings, one per macro read the analyst asked for. */
export function buildLegend(host: HTMLElement): void {
  host.replaceChildren(
    swatch(communityColour(1), 'community'),
    swatch(CUT_POINT_COLOUR, 'bridge — a cut point that severs a real piece'),
    swatch(ISOLATE_COLOUR, 'isolate'),
  );
  const badge = el('span', 'flex items-center gap-1.5 text-[11px] text-muted-foreground');
  badge.append(
    el('span', 'inline-block size-2.5 rounded-full border-2 border-dashed border-amber-500'),
    el('span', '', 'pending proposal'),
  );
  host.append(badge);
  host.append(el('span', 'text-[11px] text-muted-foreground', 'size = degree'));
}

export interface FindingRow {
  readonly kind: 'cut' | 'community' | 'isolate' | 'pending' | 'fixture';
  readonly nodeId: string;
  readonly primary: string;
  readonly secondary: string;
}

/**
 * The ranked macro reads, as rows. This is the list a bridge hunter wants and a picture cannot
 * give: at ten thousand nodes the cut points are visible as orange dots and unreadable as names.
 */
export function collectFindings(controller: GraphController): {
  readonly cuts: readonly FindingRow[];
  readonly communities: readonly FindingRow[];
  readonly isolates: readonly FindingRow[];
  readonly pending: readonly FindingRow[];
  readonly fixture: readonly FindingRow[];
} {
  const model = controller.model;
  const graph = model.graph;

  // Ranked by the size of the piece the node detaches, and not by degree. A high-degree cut
  // point that severs one leaf is worth less than a degree-two node that holds two halves apart.
  const cuts = [...model.structure.bridges.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([id, weight]) => ({
      kind: 'cut' as const,
      nodeId: id,
      primary: graph.getNodeAttribute(id, 'label'),
      secondary: `severs ${weight.toLocaleString('en-GB')} · degree ${graph.degree(id)}`,
    }));

  const communities = model.structure.communitySizes.slice(0, 25).map(([index, size]) => {
    let representative = '';
    graph.forEachNode((node) => {
      if (representative !== '') return;
      if (graph.getNodeAttribute(node, 'community') === index) representative = node;
    });
    return {
      kind: 'community' as const,
      nodeId: representative,
      primary: `Community ${index}`,
      secondary: `${size.toLocaleString('en-GB')} entities`,
    };
  });

  const isolates = model.structure.isolates.slice(0, 25).map((id) => ({
    kind: 'isolate' as const,
    nodeId: id,
    primary: graph.getNodeAttribute(id, 'label'),
    secondary: 'no relation',
  }));

  const pending = model.badgedNodes.slice(0, 25).map((id) => ({
    kind: 'pending' as const,
    nodeId: id,
    primary: graph.getNodeAttribute(id, 'label'),
    secondary: `${(model.pendingByTarget.get(id) ?? []).length} pending proposal`,
  }));

  // The rows that came from `shared/fixtures/corpus`. Everything else on this screen is invented,
  // and a reviewer needs the five real ones to be reachable in one click.
  const fixture = [...model.corpus.realEntityIds]
    .filter((id) => graph.hasNode(id))
    .map((id) => ({
      kind: 'fixture' as const,
      nodeId: id,
      primary: graph.getNodeAttribute(id, 'label'),
      secondary:
        (model.hiddenByEndpoint.get(id) ?? []).length > 0
          ? 'carries an M4 relation'
          : graph.getNodeAttribute(id, 'entityType'),
    }));

  return { cuts, communities, isolates, pending, fixture };
}
