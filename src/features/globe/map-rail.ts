import type { RailRows, RailTypeRow } from '@/shared/rail';
import { typeLabel } from '@/shared/type-label';

import type { GlobeData } from './globe-data';

/** One name in the list of a type. */
export interface MapName {
  readonly id: string;
  readonly label: string;
}

export interface MapRailState {
  readonly hiddenTypes: readonly string[];
  readonly openTypes: readonly string[];
  readonly open: boolean;
  readonly width: number;
}

interface MapRail {
  readonly rail: RailRows;
  /** The names of each open type that is on, in the order of the name. */
  readonly lists: ReadonlyMap<string, readonly MapName[]>;
}

/** The entity types of the points of the map, as the rail of the graph shows them: a switch and
 * a count for each type, and the names of each open type. */
export function mapRail(data: GlobeData, state: MapRailState): MapRail {
  const byType = new Map<string, MapName[]>();
  // A release can hold two features for one entity, such as a point and an area.
  const seen = new Set<string>();
  for (const one of data.entities.features) {
    const card = data.cards[one.id];
    if (card === undefined || seen.has(one.id)) continue;
    seen.add(one.id);
    const held = byType.get(card.type) ?? [];
    held.push({ id: one.id, label: card.label });
    byType.set(card.type, held);
  }
  const hidden = new Set(state.hiddenTypes);
  const names = [...byType.keys()].sort((one, two) => typeLabel(one).localeCompare(typeLabel(two)));

  const types: readonly RailTypeRow[] = names.map((type) => {
    const on = !hidden.has(type);
    const count = byType.get(type)?.length ?? 0;
    const label = typeLabel(type);
    return {
      type,
      label,
      initial: label.slice(0, 1).toUpperCase(),
      count,
      figure: String(count),
      on,
      open: state.openTypes.includes(type),
      stateWord: on ? 'on' : 'off, hidden',
      name: on ? `${label}, ${String(count)} on the map` : `${label}, ${String(count)} off the map`,
      // The map paints a point by its stage and not by its type, so the row draws no hue.
      colour: null,
    };
  });

  // shortcut: an open list draws every name of its type. Fold it as the graph does when a type
  // holds thousands of points.
  const lists = new Map<string, readonly MapName[]>();
  for (const type of state.openTypes) {
    const list = byType.get(type);
    if (list === undefined || hidden.has(type)) continue;
    lists.set(
      type,
      [...list].sort(
        (one, two) => one.label.localeCompare(two.label) || one.id.localeCompare(two.id),
      ),
    );
  }

  return {
    rail: {
      types,
      links: null,
      openTypes: state.openTypes,
      everyTypeOff: types.length > 0 && types.every((row) => !row.on),
      open: state.open,
      width: state.width,
    },
    lists,
  };
}
