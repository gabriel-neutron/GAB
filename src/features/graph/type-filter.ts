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

export const everyTypeShown = (): readonly string[] => DEFAULT_GRAPH_WORKSPACE.hiddenTypes;
