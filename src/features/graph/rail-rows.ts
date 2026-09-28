import { nameHoldsQuery } from '@/shared/name-match';
import type { RailRows, RailTypeRow } from '@/shared/rail';

import type { GraphView } from './controller';
import { openEntityList, type EntityMatch, type RailOpenList } from './entity-list';
import type { GraphModel } from './model';
import type { RailStep } from './rail-step';

export interface GraphRailRows {
  readonly rail: RailRows;
  readonly lists: ReadonlyMap<string, RailOpenList>;
}

export type RailView = Pick<
  GraphView,
  'filter' | 'selection' | 'openUnits' | 'railOpen' | 'railWidth'
>;

// The controller already drops a selection the filter excludes. The test below states that rule a
// second time, because a row that says "selected" about an excluded element is a lie on screen.
export function deriveRailRows(
  model: GraphModel,
  view: RailView,
  step: RailStep,
  query: string,
): GraphRailRows {
  const { filter, selection, openUnits } = view;
  const hidden = new Set(filter.hiddenTypes);

  // Departure: a type row counts every node of its type, and a fold of the list does not change
  // it.
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
  const matching = new Map<string, EntityMatch[]>();
  for (const type of filtering ? names : step.openTypes) {
    if (!counts.has(type) || hidden.has(type)) continue;
    matching.set(type, []);
  }
  // One walk of the graph fills every list. A walk per type would read the whole graph once for
  // each one, and every type may stand open at the same moment.
  if (matching.size > 0) {
    model.graph.forEachNode((node, attrs) => {
      if (!nameHoldsQuery(attrs.label, query)) return;
      matching.get(attrs.entityType)?.push({ id: node, label: attrs.label, degree: attrs.degree });
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
    const whole = step.wholeList.includes(type);
    lists.set(
      type,
      openEntityList(model.hierarchy, type, matches, { openUnits, selectedId, filtering, whole }),
    );
  }

  return {
    rail: {
      types,
      links: null,
      openTypes,
      everyTypeOff,
      open: view.railOpen,
      width: view.railWidth,
    },
    lists,
  };
}
