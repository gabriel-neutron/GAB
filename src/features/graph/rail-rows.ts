import { nameHoldsQuery } from '@/shared/name-match';
import type { RailRows, RailTypeRow } from '@/shared/rail';

import type { GraphSelection } from './controller';
import type { FilterState } from './controller';
import type { GraphModel } from './model';
import { DEFAULT_GRAPH_WORKSPACE } from './workspace';

// This graph holds thousands of entities of one type, and a rail of 2500 rows is not a rail. The
// number is the one the accepted prototype used, and it is a tuning value. The remainder is
// stated beside the list.
const LIST_CAP = 60;

export interface RailStep {
  readonly openTypes: readonly string[];
  readonly wholeList: readonly string[];
}

export interface RailEntityRow {
  readonly id: string;
  readonly label: string;
  readonly degree: number;
  readonly selected: boolean;
}

export interface RailOpenList {
  readonly type: string;
  readonly entities: readonly RailEntityRow[];
  readonly remainder: number;
}

export interface GraphRailRows {
  readonly rail: RailRows;
  readonly lists: ReadonlyMap<string, RailOpenList>;
}

// The workspace holds the types that are switched off, and not the types shown. A control that
// computed the set for itself would hold that polarity in a second file.
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

export const everyTypeShown = (): readonly string[] => DEFAULT_GRAPH_WORKSPACE.hiddenTypes;

// The controller already drops a selection the filter excludes. The test below states that rule a
// second time, because a row that says "selected" about an excluded element is a lie on screen.
export function deriveRailRows(
  model: GraphModel,
  filter: FilterState,
  step: RailStep,
  selection: GraphSelection | null,
  open: boolean,
  query: string,
): GraphRailRows {
  const hidden = new Set(filter.hiddenTypes);

  const counts = new Map<string, number>();
  model.graph.forEachNode((_node, attrs) => {
    counts.set(attrs.entityType, (counts.get(attrs.entityType) ?? 0) + 1);
  });

  // The order is the name, and it does not move when a filter changes. A row that changes place
  // under the pointer is a row the analyst clicks by mistake.
  const names = [...counts.keys()].sort((one, two) => one.localeCompare(two));

  const selectedId = selection !== null && selection.kind === 'entity' ? selection.id : null;

  // Departure: under a filter every type that is on gets a list, so the walk finds each type
  // that holds a match. Without a filter only the types the analyst opened get one.
  const filtering = query.trim() !== '';
  const matching = new Map<string, RailEntityRow[]>();
  for (const type of filtering ? names : step.openTypes) {
    if (!counts.has(type) || hidden.has(type)) continue;
    matching.set(type, []);
  }
  // One walk of the graph fills every list. A walk per type would read the whole graph once for
  // each one, and every type may stand open at the same moment.
  if (matching.size > 0) {
    model.graph.forEachNode((node, attrs) => {
      if (!nameHoldsQuery(attrs.label, query)) return;
      matching.get(attrs.entityType)?.push({
        id: node,
        label: attrs.label,
        degree: attrs.degree,
        selected: node === selectedId,
      });
    });
  }

  // Departure: a filter opens each type that holds a match and never writes `step`, so the
  // folds the analyst chose come back when the filter is empty again.
  const autoOpened = names.filter(
    (type) => (matching.get(type)?.length ?? 0) > 0 && !step.openTypes.includes(type),
  );
  const openTypes = filtering ? [...step.openTypes, ...autoOpened] : step.openTypes;

  const types: readonly RailTypeRow[] = names.map((type) => {
    const on = !hidden.has(type);
    const count = counts.get(type) ?? 0;
    return {
      type,
      initial: type.slice(0, 1).toUpperCase(),
      count,
      on,
      open: openTypes.includes(type),
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

  const lists = new Map<string, RailOpenList>();
  for (const [type, matches] of matching) {
    if (!openTypes.includes(type)) continue;
    // The hubs come first, and the name is the tie-break, so the same corpus gives the same head
    // on every open. The degree alone does not promise that.
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
    rail: { types, links: null, openTypes, everyTypeOff, open },
    lists,
  };
}
