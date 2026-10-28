import { canvasTheme } from '@/shared/canvas-theme';

// MapLibre parses colour strings and never a CSS variable, so the design tokens are read from the
// document once per theme and handed to the style as hex.

export interface MapTokens {
  readonly water: string;
  /** The dark edge under a route, an arc or a selection, on both themes. */
  readonly casing: string;
  readonly land: string;
  readonly boundary: string;
  readonly label: string;
  readonly ring: string;
  readonly signal: string;
  readonly muted: string;
  readonly family: Readonly<Record<LinkFamily, string>>;
}

export type LinkFamily = 'ownership' | 'designation' | 'operation' | 'transfer' | 'other';

/** The dash of each family in px along the line (mark, gap, mark, gap): `RelationLine`. */
export const FAMILY_DASH: Readonly<Record<LinkFamily, readonly number[]>> = {
  ownership: [1, 0],
  designation: [12, 5],
  operation: [5, 4],
  transfer: [12, 4, 2, 4],
  other: [2, 5],
};

export const FAMILY_LABEL: Readonly<Record<LinkFamily, string>> = {
  ownership: 'Ownership',
  designation: 'Designation',
  operation: 'Operation',
  transfer: 'Ship-to-ship transfer',
  other: 'Other relations',
};

export const EVERY_FAMILY = Object.keys(FAMILY_DASH) as readonly LinkFamily[];

// A choice and not a declaration of the database, as on the graph: a type that is not here reads
// as `other`.
const FAMILY_OF_TYPE: ReadonlyMap<string, LinkFamily> = new Map<string, LinkFamily>([
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
  ['acts_for', 'operation'],
  ['supplies_items_to', 'operation'],
  ['transfers_funds_to', 'operation'],
  ['pays_for', 'operation'],
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

export const familyOfLink = (type: string): LinkFamily => FAMILY_OF_TYPE.get(type) ?? 'other';

// An absent token (a test document with no stylesheet) reads as a mid grey, never as an empty
// string, which the style parser rejects.
const NO_TOKEN = '#808080';

const read = (name: string): string => {
  const held = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return held === '' ? NO_TOKEN : held;
};

export function mapTokens(): MapTokens {
  return {
    water: read('map-water'),
    // `ring` is near white on Obsidian and near black on Bone, so the dark edge is the water there.
    casing: canvasTheme() === 'dark' ? read('map-water') : read('ring'),
    land: read('map-land'),
    boundary: read('map-boundary'),
    label: read('map-label'),
    ring: read('ring'),
    signal: read('signal'),
    muted: read('muted-foreground'),
    family: {
      ownership: read('relation-ownership'),
      designation: read('relation-designation'),
      operation: read('relation-operation'),
      transfer: read('relation-transfer'),
      other: read('relation-other'),
    },
  };
}
