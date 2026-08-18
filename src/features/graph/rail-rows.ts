/**
 * The rows the layer rail draws.
 *
 * Built from `docs/graph-surface.md` §4.4, §5.1, §5.2 and §8 step 5.
 *
 * **The rail draws, and this file computes.** The skill puts the sort, the cap, the remainder and
 * the match of the field in a `.ts`, so that the `.tsx` holds one `.map` for each array it is
 * given and no read of the graph at all.
 *
 * **It is a second file, and not a second job inside `./model`.** `./model` builds one typed
 * graph, attaches the paint and holds the three indexes. The rows of a control are a different
 * job, and one file holds one main runtime symbol. The name says the job, and it is never
 * `utils.ts`.
 *
 * **The three differences from the map, each with its reason** — §4.4:
 *
 * - *No colour beside a type.* On the map the hue **is** the encoding. Here the hue is the
 *   community, the bridge and the isolate (§4.2), so a type colour would state an encoding this
 *   canvas does not use. So no row below carries a colour, and the count carries the weight.
 * - *The list of entities is capped, and the remainder is a number on the row.* The map holds
 *   tens of rows; this graph holds thousands, and a rail of 2 500 rows is not a rail. A surface
 *   that drops evidence in silence is worse than one that states how much it dropped.
 * - *The list is in the order of the degree.* The useful head of a list on a graph is the hubs. A
 *   name is reached with the field, which is what the field is for.
 *
 * **It reads the graph, and never the corpus.** A row that names an entity the canvas does not
 * draw is a row that selects nothing. `./model` drops an entity with no position and states the
 * count, so the rail lists what is on the screen.
 */

import type { RailRows, RailTypeRow } from '@/shared/rail';

import type { GraphSelection } from './bridge';
import type { FilterState } from './controller';
import type { GraphModel } from './model';
import { DEFAULT_GRAPH_WORKSPACE } from './workspace';

/**
 * How many entity rows one unfolded type draws.
 *
 * **The number is the one the accepted prototype used**, and the remainder is stated beside the
 * list. §4.4 asks for the cap and for the remainder, and it names no figure.
 *
 * **No ticket owns this number, and it guesses at no open question.** §4.4 gives the rule — the
 * list "is capped, and the remainder is on screen" — so the rule is decided and the number alone
 * is chosen: this is a tuning value.
 */
const LIST_CAP = 60;

/**
 * The two steps of the rail, as the analyst left them.
 *
 * `openType` is `null` at the first step, where the rail shows the type rows only. A string is
 * the second step: that one type is unfolded, and the field belongs to it. **One type at a time**,
 * so the rail never becomes the whole corpus by accident — §4.4.
 */
export interface RailStep {
  readonly openType: string | null;
}

/** One entity row of the second step. The list is already sorted, already capped. */
export interface RailEntityRow {
  readonly id: string;
  readonly label: string;
  readonly degree: number;
  readonly selected: boolean;
}

/** The second step: the type that is unfolded, and its list. */
export interface RailOpenList {
  readonly type: string;
  readonly entities: readonly RailEntityRow[];
  /** How many entities match and are not drawn. §4.4: the remainder is on the screen. */
  readonly remainder: number;
  /** How many entities of the type the canvas draws, for the line that says no name matches. */
  readonly count: number;
}

/**
 * What the rail draws: the shape `src/shared/rail.tsx` takes, and the list of the second step,
 * which the shared control does not own.
 */
export interface GraphRailRows {
  readonly rail: RailRows;
  /** `null` at the first step, and at a type that is switched off. */
  readonly open: RailOpenList | null;
}

/**
 * The hidden set after one switch. **The polarity of §5.2 lives here**, and never in a `.tsx`:
 * the workspace holds the types that are **off**, and a control that computed the set for itself
 * would hold that rule in a second file.
 *
 * It is beside `deriveRailRows` because it is the same job: both answer "what does the rail say
 * about the filter", one for the drawing and one for the act that changes it.
 */
export function hiddenAfterSwitch(
  filter: FilterState,
  type: string,
  on: boolean,
): readonly string[] {
  const hidden = new Set(filter.hiddenTypes);
  if (on) hidden.delete(type);
  else hidden.add(type);
  return [...hidden];
}

/** The way back of §5.2, taken from the stored default and never invented. */
export const everyTypeShown = (): readonly string[] => DEFAULT_GRAPH_WORKSPACE.hiddenTypes;

/**
 * The rows of the rail, for one model, one filter and one step.
 *
 * `selection` comes from the published view. **The controller has already dropped a selection
 * that the filter excludes** (§5.1), so a row of an excluded type never reads as selected; the
 * test below states that rule a second time, because a row that says "selected" about an element
 * out of consideration is a lie on the screen.
 */
export function deriveRailRows(
  model: GraphModel,
  filter: FilterState,
  step: RailStep,
  selection: GraphSelection | null,
  open: boolean,
): GraphRailRows {
  const hidden = new Set(filter.hiddenTypes);

  const counts = new Map<string, number>();
  model.graph.forEachNode((_node, attrs) => {
    counts.set(attrs.entityType, (counts.get(attrs.entityType) ?? 0) + 1);
  });

  // The order is the name, and it does not move when a filter changes. A row that changes place
  // under the pointer is a row the analyst clicks by mistake.
  const names = [...counts.keys()].sort((one, two) => one.localeCompare(two));

  const types: readonly RailTypeRow[] = names.map((type) => {
    const on = !hidden.has(type);
    const count = counts.get(type) ?? 0;
    return {
      type,
      initial: type.slice(0, 1).toUpperCase(),
      count,
      on,
      open: step.openType === type,
      // §5.2 dims and never hides, so the row states that consequence. The word reaches a reader
      // who sees no strike and no dimming.
      stateWord: on ? 'on' : 'off, dimmed',
      name: on ? `${type}, ${count}, on` : `${type}, ${count}, off and dimmed`,
      // §4.4, the first difference: no colour beside a type. Here the hue is the community and
      // not the type, so a type colour would state an encoding this canvas does not use.
      colour: null,
    };
  });

  const everyTypeOff = types.length > 0 && types.every((row) => !row.on);

  const openType = step.openType;
  const openIsDrawn = openType !== null && counts.has(openType) && !hidden.has(openType);

  let openList: RailOpenList | null = null;
  if (openType !== null && openIsDrawn) {
    const selectedId = selection !== null && selection.kind === 'entity' ? selection.id : null;

    const matches: RailEntityRow[] = [];
    model.graph.forEachNode((node, attrs) => {
      if (attrs.entityType !== openType) return;
      matches.push({
        id: node,
        label: attrs.label,
        degree: attrs.degree,
        selected: node === selectedId,
      });
    });

    // §4.4: the hubs first. The name is the tie-break, so the same corpus gives the same head on
    // every open, which the degree alone does not promise.
    matches.sort((one, two) => two.degree - one.degree || one.label.localeCompare(two.label));

    const drawn = matches.slice(0, LIST_CAP);
    openList = {
      type: openType,
      entities: drawn,
      remainder: matches.length - drawn.length,
      count: counts.get(openType) ?? 0,
    };
  }

  return {
    rail: { types, openType, everyTypeOff, open },
    open: openList,
  };
}
