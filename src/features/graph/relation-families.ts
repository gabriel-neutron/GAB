import type { GraphGround } from './model';

export type RelationFamily = 'ownership' | 'designation' | 'operation' | 'transfer' | 'other';

/** A repeating pattern in pixels along the line: mark, gap, mark, gap. A gap of 0 is a solid line. */
export type DashPattern = readonly [number, number, number, number];

export interface FamilyLook {
  readonly key: RelationFamily;
  readonly label: string;
  readonly dash: DashPattern;
  /** `#rrggbb`: Sigma parses hex on the CPU, and a CSS custom property never reaches it. */
  readonly hue: Readonly<Record<GraphGround, string>>;
}

// Contrast of each hue against the ground of the same theme, where the minimum is 3:1. The dark
// set gives 5.5:1 to 9.3:1 on the dark ground, and the light set gives 4.3:1 to 6.1:1 on the light
// ground. The dash pattern carries the difference alone where the hue cannot be told apart.
export const FAMILIES: readonly FamilyLook[] = [
  {
    key: 'ownership',
    label: 'Ownership',
    dash: [1, 0, 0, 0],
    hue: { light: '#1f6fb2', dark: '#5aa9e6' },
  },
  {
    key: 'designation',
    label: 'Designation',
    dash: [12, 5, 0, 0],
    hue: { light: '#b45f06', dark: '#f0a04b' },
  },
  {
    key: 'operation',
    label: 'Operation',
    dash: [5, 4, 0, 0],
    hue: { light: '#0b7a5c', dark: '#4fc9a4' },
  },
  {
    key: 'transfer',
    label: 'Ship-to-ship transfer',
    dash: [12, 4, 2, 4],
    hue: { light: '#7b3fb5', dark: '#c58af0' },
  },
  {
    key: 'other',
    label: 'Other relations',
    dash: [2, 5, 0, 0],
    hue: { light: '#5e6468', dark: '#848a8c' },
  },
];

// A choice, not a declaration of the database: `relation_type` holds no family. The four families
// are the ones the analyst asks for. A type that is not here, and a type that a later migration
// adds, reads as `other` until a person places it.
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

// The three exports are one job: the list of families, the map from a type to its family, and the
// look of a family.
export const familyOf = (relationType: string): RelationFamily =>
  FAMILY_OF_TYPE.get(relationType) ?? 'other';

const LOOK_OF_FAMILY: ReadonlyMap<RelationFamily, FamilyLook> = new Map(
  FAMILIES.map((family) => [family.key, family]),
);

export function lookOf(family: RelationFamily): FamilyLook {
  const look = LOOK_OF_FAMILY.get(family);
  // `FAMILIES` holds every member of the union, so this branch states the type and runs never.
  if (look === undefined) throw new Error(`No look for the relation family ${family}`);
  return look;
}
