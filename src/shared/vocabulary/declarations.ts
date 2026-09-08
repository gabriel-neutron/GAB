/**
 * Every word the seed of the database writes, with every column of the row. This is the only
 * place a type or a key is declared, and the seed file is written from it. */

import type { AttributeKind } from '../read/model';

/** One row of `entity_type`. `ord` is the print order of a list of types. */
export interface SeededEntityType {
  readonly key: string;
  readonly label: string;
  readonly colourLight: string;
  readonly colourDark: string;
  readonly ord: number;
}

/** One row of `attribute_key`. `stem` is the concept and never the spelling. */
export interface SeededAttributeKey {
  readonly key: string;
  readonly stem: string;
  readonly kind: AttributeKind;
  readonly label: string;
  readonly unit: string | null;
  readonly pattern: string | null;
}

const DAY = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';
const PRECISION = '^(exact|approximate|inherited)$';

const entityType = (
  key: string,
  label: string,
  colourLight: string,
  colourDark: string,
  ord: number,
): SeededEntityType => ({ key, label, colourLight, colourDark, ord });

// The stem is the key, because the first spelling is permanent. A key that carries a unit in its
// spelling states the shorter concept it declares.
const attributeKey = (
  key: string,
  kind: AttributeKind,
  label: string,
  unit: string | null = null,
  pattern: string | null = null,
  stem: string = key,
): SeededAttributeKey => ({ key, stem, kind, label, unit, pattern });

export const seededVocabulary: {
  readonly retiredWhenSeeded: boolean;
  readonly entityTypes: readonly SeededEntityType[];
  readonly attributeKeys: readonly SeededAttributeKey[];
} = {
  // Both tables default `retired` to false and the seed writes no such column, so every seeded
  // word is in service on the day it lands.
  retiredWhenSeeded: false,

  entityTypes: [
    entityType('vessel', 'Vessel', '#2971c6', '#70adfb', 10),
    entityType('facility', 'Facility', '#007989', '#00c2d2', 20),
    entityType('company', 'Company', '#007d50', '#53c48e', 30),
    entityType('person', 'Person', '#677000', '#a8b44b', 40),
    entityType('military_unit', 'Military unit', '#8254c4', '#b7a0e4', 50),
    // `unknown` takes the grey and sorts last: a grey says that no type was recognised.
    entityType('unknown', 'Unknown', '#6b7280', '#9ca3af', 900),
  ],

  attributeKeys: [
    attributeKey('imo', 'identifier', 'IMO number', null, '^[0-9]{7}$'),
    attributeKey('registration_number', 'identifier', 'Registration number'),
    attributeKey('ice_class', 'identifier', 'Ice class'),
    attributeKey('incorporated_on', 'date', 'Incorporated on', null, DAY),
    attributeKey('observed_on', 'date', 'Observed on', null, DAY),
    attributeKey('beneficial_owner_count', 'quantity', 'Beneficial owners'),
    attributeKey('berth_count', 'quantity', 'Berths'),
    attributeKey('coal_stock_t', 'quantity', 'Coal stock', 't', null, 'coal_stock'),
    attributeKey('conveyor_lines', 'quantity', 'Conveyor lines'),
    attributeKey('dry_dock_count', 'quantity', 'Dry docks'),
    attributeKey('mole_length_m', 'quantity', 'Mole length', 'm', null, 'mole_length'),
    attributeKey('share_pct', 'quantity', 'Shareholding', '%', null, 'share'),
    attributeKey('teu_capacity', 'quantity', 'TEU capacity', 'TEU'),
    attributeKey('throughput_kt_month', 'quantity', 'Throughput', 'kt/month', null, 'throughput'),
    attributeKey('trains_operating', 'quantity', 'Trains operating'),
    attributeKey('ice_class_required', 'boolean', 'Ice class required'),
    attributeKey('operator_confirmed', 'boolean', 'Operator confirmed'),
    attributeKey('seasonal_closure', 'boolean', 'Seasonal closure'),
    attributeKey('known_flags', 'list', 'Known flags', null, '^[A-Z]{2}$'),
    attributeKey('last_port_call', 'text', 'Last port call'),
    attributeKey('role_title', 'text', 'Role'),
    attributeKey('crane_note', 'note', 'Crane note'),
    attributeKey('hull_note', 'note', 'Hull note'),
    attributeKey('note', 'note', 'Note'),
    attributeKey('unit_type', 'text', 'Unit type'),
    attributeKey('echelon', 'text', 'Echelon'),
    attributeKey('domain', 'text', 'Domain'),
    attributeKey('organisation_type', 'text', 'Organisation type'),
    attributeKey('military_unit_id', 'identifier', 'Military unit number'),
    // It sits on the facility and never on the unit: 15 of the 122 places are shared by up to
    // six units, so on a unit the claim would be false.
    attributeKey('osm_relation_id', 'identifier', 'OSM relation'),
    // What the load itself states, so that every loss is a query and not a line in a document.
    attributeKey('v1_id', 'identifier', 'v1 identifier'),
    attributeKey('src_scope', 'text', 'Source scope'),
    attributeKey('src_inherit_depth', 'quantity', 'Source inheritance depth'),
    attributeKey('src_inherited_from', 'identifier', 'Source inherited from'),
    attributeKey('position_precision', 'text', 'Position precision', null, PRECISION),
  ],
};
