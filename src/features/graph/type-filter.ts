import { DEFAULT_GRAPH_WORKSPACE, type GraphWorkspace } from './workspace';

export type FilterState = Pick<GraphWorkspace, 'hiddenTypes'>;

// Departure: the workspace holds the types that are switched off, and not the types shown. A
// control that computed the set for itself would hold that polarity in a second file.
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

/** The one rule of what the canvas draws: a node passes unless its type is switched off, or it
 * stands on the ring and the switch for the ring is off. The selection, the focus and the lists
 * all read this rule, so a node that is not drawn is never selected or made a centre. */
export const isShown = (
  node: { readonly entityType: string; readonly unplaced: boolean },
  hiddenTypes: ReadonlySet<string>,
  showUnplaced: boolean,
): boolean => !hiddenTypes.has(node.entityType) && (showUnplaced || !node.unplaced);

export const everyTypeShown = (): readonly string[] => DEFAULT_GRAPH_WORKSPACE.hiddenTypes;
