/**
 * The declarations the seed of the database writes, as a story reads them. A story reaches no
 * database, so it carries this; the application reads the live rows and never this file. */

import type { Vocabulary } from '../read/model';

const DAY = '^[0-9]{4}-[0-9]{2}-[0-9]{2}$';

const declared = (
  key: string,
  kind: Vocabulary[number]['kind'],
  label: string,
  unit: string | null = null,
  pattern: string | null = null,
): Vocabulary[number] => ({ key, kind, label, unit, pattern, retired: false });

export const vocabulary: Vocabulary = [
  declared('imo', 'identifier', 'IMO number', null, '^[0-9]{7}$'),
  declared('registration_number', 'identifier', 'Registration number'),
  declared('ice_class', 'identifier', 'Ice class'),
  declared('incorporated_on', 'date', 'Incorporated on', null, DAY),
  declared('observed_on', 'date', 'Observed on', null, DAY),
  declared('beneficial_owner_count', 'quantity', 'Beneficial owners'),
  declared('berth_count', 'quantity', 'Berths'),
  declared('coal_stock_t', 'quantity', 'Coal stock', 't'),
  declared('conveyor_lines', 'quantity', 'Conveyor lines'),
  declared('dry_dock_count', 'quantity', 'Dry docks'),
  declared('mole_length_m', 'quantity', 'Mole length', 'm'),
  declared('share_pct', 'quantity', 'Shareholding', '%'),
  declared('teu_capacity', 'quantity', 'TEU capacity', 'TEU'),
  declared('throughput_kt_month', 'quantity', 'Throughput', 'kt/month'),
  declared('trains_operating', 'quantity', 'Trains operating'),
  declared('ice_class_required', 'boolean', 'Ice class required'),
  declared('operator_confirmed', 'boolean', 'Operator confirmed'),
  declared('seasonal_closure', 'boolean', 'Seasonal closure'),
  declared('known_flags', 'list', 'Known flags', null, '^[A-Z]{2}$'),
  declared('last_port_call', 'text', 'Last port call'),
  declared('role_title', 'text', 'Role'),
  declared('crane_note', 'note', 'Crane note'),
  declared('hull_note', 'note', 'Hull note'),
  declared('note', 'note', 'Note'),
];
