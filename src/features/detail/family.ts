// A copy of the choice of the graph (`features/graph/relation-families.ts`): a feature never
// imports a feature. The chrome session should move both to `src/shared`.
export type RelationFamily = 'ownership' | 'designation' | 'operation' | 'transfer' | 'other';

export interface FamilyLook {
  readonly key: RelationFamily;
  readonly label: string;
  /** `stroke-dasharray` of the sample line. Empty is solid. */
  readonly dash: string;
  /** A whole class name, so Tailwind finds it. */
  readonly hue: string;
}

export const FAMILIES: readonly FamilyLook[] = [
  { key: 'ownership', label: 'Ownership', dash: '', hue: 'text-relation-ownership' },
  { key: 'designation', label: 'Designation', dash: '12 5', hue: 'text-relation-designation' },
  { key: 'operation', label: 'Operation', dash: '5 4', hue: 'text-relation-operation' },
  {
    key: 'transfer',
    label: 'Ship-to-ship transfer',
    dash: '12 4 2 4',
    hue: 'text-relation-transfer',
  },
  { key: 'other', label: 'Other relations', dash: '2 5', hue: 'text-relation-other' },
];

const FAMILY_OF_TYPE: ReadonlyMap<string, RelationFamily> = new Map([
  ['owns', 'ownership'],
  ['flags', 'ownership'],
  ['insures', 'ownership'],
  ['appoints', 'ownership'],
  ['subordinate_to', 'ownership'],
  ['designated_by', 'designation'],
  ['restricted_by', 'designation'],
  ['exempted_by', 'designation'],
  ['operates', 'operation'],
  ['charters', 'operation'],
  ['carried_out_by', 'operation'],
  ['settles_through', 'operation'],
  ['supplies_crude_to', 'operation'],
  ['sells_products_to', 'operation'],
  ['crude_flows_to', 'operation'],
  ['products_flow_to', 'operation'],
  ['gas_flows_to', 'operation'],
  ['berthed_at', 'operation'],
  ['loads_at', 'operation'],
  ['discharges_at', 'operation'],
  ['inspected_at', 'operation'],
  ['occurred_at', 'operation'],
  ['sts_with', 'transfer'],
]);

export const familyOf = (relationType: string): RelationFamily =>
  FAMILY_OF_TYPE.get(relationType) ?? 'other';
