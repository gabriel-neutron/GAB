/**
 * The rows the layer rail draws.
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
 * **The differences from the map, each with its reason:**
 *
 * - *A colour beside a type, on both surfaces.* **This was the first difference, and it is
 *   gone.** The hue of this canvas was the community, so a type colour would have stated an
 *   encoding the canvas did not use. The hue is the type now, on both canvases, so the swatch
 *   says a true thing here as it does on the map — and it is **the words that the hue owes a
 *   reader who cannot see it**, which is why the swatch is asked for and not only the one
 *   product.
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
 * list. The surface asks for the cap and for the remainder, and it names no figure.
 *
 * **No ticket owns this number, and it guesses at no open question.** The rule is that the list
 * "is capped, and the remainder is on screen", so the rule is decided and the number alone is
 * chosen: this is a tuning value.
 */
const LIST_CAP = 60;

/**
 * The two steps of the rail, as the analyst left them.
 *
 * **More than one type may stand unfolded.** The rule that closed one list to open the next is
 * gone: it stopped an analyst reading two lists beside each other, and neither surface needed it.
 */
export interface RailStep {
  /** Every type the analyst unfolded. Empty is the first step, with the type rows only. */
  readonly openTypes: readonly string[];
  /**
   * The types whose **whole** list is drawn, past the cap.
   *
   * The operator ruled that the line which counted the dropped rows becomes a control that opens
   * them. The order does not change: the hubs stay first.
   */
  readonly wholeList: readonly string[];
}

/** One entity row of the second step. The list is already sorted, already capped. */
export interface RailEntityRow {
  readonly id: string;
  readonly label: string;
  readonly degree: number;
  readonly selected: boolean;
}

/** The second step: one unfolded type, and its list. */
export interface RailOpenList {
  readonly type: string;
  readonly entities: readonly RailEntityRow[];
  /**
   * How many entities of this type the cap leaves out. The number is on the screen, and it is a
   * control that draws them. It is 0 once the whole list is open.
   */
  readonly remainder: number;
}

/**
 * What the rail draws: the shape `src/shared/rail.tsx` takes, and the list of the second step,
 * which the shared control does not own.
 */
export interface GraphRailRows {
  readonly rail: RailRows;
  /**
   * One list for each type that stands unfolded **and** is drawn, by type name. A type that is
   * switched off has no entry: the surface draws none of it.
   */
  readonly lists: ReadonlyMap<string, RailOpenList>;
}

/**
 * The hidden set after one switch. **The polarity of the filter lives here**, and never in a
 * `.tsx`: the workspace holds the types that are **off**, and a control that computed the set for
 * itself would hold that rule in a second file.
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

/** The way back to every type shown, taken from the stored default and never invented. */
export const everyTypeShown = (): readonly string[] => DEFAULT_GRAPH_WORKSPACE.hiddenTypes;

/**
 * The rows of the rail, for one model, one filter and one step.
 *
 * `selection` comes from the published view. **The controller has already dropped a selection
 * that the filter excludes**, so a row of an excluded type never reads as selected; the test
 * below states that rule a second time, because a row that says "selected" about an element out
 * of consideration is a lie on the screen.
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
      open: step.openTypes.includes(type),
      // The filter dims and never hides, so the row states that consequence. The word reaches a
      // reader who sees no strike and no dimming.
      stateWord: on ? 'on' : 'off, dimmed',
      name: on ? `${type}, ${count}, on` : `${type}, ${count}, off and dimmed`,
      // **The swatch is the words of the hue.** The canvas paints a node by its type, and a hue
      // alone is hidden from a reader who cannot see it, so the one place that names every type
      // carries the colour beside the name.
      colour: model.hueOfType.get(type) ?? null,
    };
  });

  const everyTypeOff = types.length > 0 && types.every((row) => !row.on);

  const selectedId = selection !== null && selection.kind === 'entity' ? selection.id : null;

  // One walk of the graph fills every open list. A walk per open type would read the whole graph
  // once for each one, and every type may stand open at the same moment.
  const matching = new Map<string, RailEntityRow[]>();
  for (const type of step.openTypes) {
    if (!counts.has(type) || hidden.has(type)) continue;
    matching.set(type, []);
  }
  if (matching.size > 0) {
    model.graph.forEachNode((node, attrs) => {
      matching.get(attrs.entityType)?.push({
        id: node,
        label: attrs.label,
        degree: attrs.degree,
        selected: node === selectedId,
      });
    });
  }

  const lists = new Map<string, RailOpenList>();
  for (const [type, matches] of matching) {
    // The hubs come first. The name is the tie-break, so the same corpus gives the same head on
    // every open, which the degree alone does not promise. **This order holds when the whole list
    // opens**: the operator asked for the most connected first either way.
    matches.sort((one, two) => two.degree - one.degree || one.label.localeCompare(two.label));

    const whole = step.wholeList.includes(type);
    const drawn = whole ? matches : matches.slice(0, LIST_CAP);
    lists.set(type, {
      type,
      entities: drawn,
      remainder: matches.length - drawn.length,
    });
  }

  return {
    rail: { types, openTypes: step.openTypes, everyTypeOff, open },
    lists,
  };
}
