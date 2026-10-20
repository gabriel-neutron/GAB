import type { GraphWorkspace } from './workspace';

export type RelationFilterState = Pick<GraphWorkspace, 'hiddenRelationTypes'>;

// The workspace holds the relation types that are switched off, as it holds the entity types that
// are off: the record gains a type when a document does, and a stored list of the types that are
// on would hide each new type.
export function hiddenRelationsAfterSwitch(
  filter: RelationFilterState,
  type: string,
  on: boolean,
): readonly string[] {
  const hidden = new Set(filter.hiddenRelationTypes);
  if (on) hidden.delete(type);
  else hidden.add(type);
  return [...hidden];
}
