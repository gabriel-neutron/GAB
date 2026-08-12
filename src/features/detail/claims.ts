/**
 * An attribute set that declares nothing, read as rows a surface can draw.
 *
 * Built from `docs/detail-surface.md` §3.2, §4.1 and §4.2.
 *
 * **This whole file is the guess of §3.2, and it is the only place that holds it.** The model
 * carries no type, no unit, no group and no order for an attribute, so this file takes the
 * control from the shape of the value, the group from the name of the key, and the order from
 * the alphabet. Each rule is named as a guess where it stands.
 *
 * **It reports to #46 and it dies with #46.** The day an attribute arrives with its type, its
 * unit and its group, every rule below is deleted and nothing else changes: the file is one
 * function over one argument, and it imports no read module.
 *
 * It returns the rows in group order, and the alphabet inside each group. The caller inserts
 * the headings, because a flat list of rows is what lets the record hold one `.map`.
 */

import type { AttributeValue, Attributes, DocId } from '@/shared/fixtures/types';

/** The control the value asks for. §4.2: a list is joined into the one box. */
export type ClaimControl = 'boolean' | 'number' | 'date' | 'text' | 'note' | 'list';

/**
 * The width of the cell, as a name and never as a class.
 *
 * §4.1 gives four widths: 17 rem, 20 rem, 26 rem and the whole line. A derivation holds no
 * class string, so the presentation maps these four names to the four widths.
 */
export type ClaimWidth = 'short' | 'date' | 'medium' | 'line';

/**
 * The value, with the control it asks for. A closed set: a caller cannot build a checkbox with
 * no state, and cannot build a list with no count.
 */
export type ClaimValue =
  | { readonly control: 'boolean'; readonly checked: boolean; readonly text: string }
  | { readonly control: 'number' | 'date' | 'text' | 'note'; readonly text: string }
  | { readonly control: 'list'; readonly text: string; readonly count: number };

export interface ClaimRow {
  /** The attribute key. It is the domain identifier of the row, and the key of the list. */
  readonly key: string;
  /** The key, humanised. §3.2: the model carries no label either. */
  readonly label: string;
  readonly group: string;
  readonly value: ClaimValue;
  /**
   * The guess, said out loud: `a date`, `a number`, `yes or no`, `a list of 3`, `text`. §3.2
   * asks that each guess stays visible in the code; this puts it on the screen as well, so an
   * analyst reads what the surface assumed and never mistakes it for a declared type.
   */
  readonly controlWord: string;
  readonly width: ClaimWidth;
  /** M8: every claim carries the documents it comes from. No control hides them (§5.1). */
  readonly sources: readonly DocId[];
}

/** A text of exactly this shape is read as a date. A guess at #46. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Longer than this, or with a line break, and the text is read as a note. A guess at #46. */
const NOTE_LENGTH = 48;

/** §4.1: a yes-or-no, or a text up to this length, takes the 17 rem cell. */
const SHORT_LENGTH = 12;

/** §4.1: a text up to this length takes the 26 rem cell. Longer takes the whole line. */
const MEDIUM_LENGTH = 34;

/**
 * The group of a claim, taken from the name of its key. **A guess at #46**, and the second of
 * the three that §3.2 records.
 *
 * **This table is first-match-wins, so its order is its precedence and nothing else.** The
 * order of the groups on the screen is `GROUP_ORDER` below, and the two are separate lists on
 * purpose. The defect that made them separate: `/_note$/` was the last row, and `condition_note`
 * matched `condition_` five rows above it, so every note was filed under "Class and survey" and
 * the "Analyst notes" group received nothing. A note is a note whatever its prefix, so that row
 * is now first. **Do not move it back down, and do not read this order as the screen order.**
 * One list for both jobs put the analyst notes at the top of the record, above the identity of
 * the vessel.
 *
 * The order the keys arrive in is not used, because no order arrives.
 *
 * Three notes a reader must not lose:
 *
 * - The fifth row was labelled `Certificates` in the prototype, and it matches `cranes`,
 *   `scrubber` and `ballast_water`, which are equipment and not a certificate. The label is
 *   corrected here. **Do not restore the old one**: it named the group after one part of what
 *   it holds.
 * - A key that matches no row lands in the last group, and that is correct. The committed
 *   corpus has `registration_number`, which five entities carry and which no row matches. A
 *   default group that says "other" is honest; a rule invented to capture it would be a second
 *   guess at #46.
 * - One more row is shadowed the same way, and it is **not** corrected here: `imo_number_marked`
 *   is named in the sixth row, and the first row matches every key that starts with `imo`, so
 *   that key lands in "Identity". Which group it belongs to is a question for the operator on
 *   #46, and a rule invented here would be a second guess.
 */
const GROUP_RULES: readonly (readonly [RegExp, string])[] = [
  // First, and on purpose. See the note above: a later row for a note never fires.
  [/_note$/, 'Analyst notes'],
  [
    /^(imo|mmsi|call_sign|vessel_|former_names|flag_state|port_of_registry|official_|hull_number|keel_|delivered_)/,
    'Identity',
  ],
  [
    /^(length_|beam_|depth_|summer_|gross_|net_tonnage|deadweight|lightship|grain_|bale_|holds_|hatches_)/,
    'Dimensions',
  ],
  [
    /^(engine_|propellers|bunker_|service_speed|maximum_speed|daily_consumption|auxiliary_)/,
    'Machinery',
  ],
  [
    /^(class_|ice_class|last_special|next_special|last_drydock|next_drydock|last_annual|condition_|psc_|last_psc)/,
    'Class and survey',
  ],
  [
    /^(cranes|crane_|scrubber|ballast_water|eedi|carbon_intensity|imo_number_marked|safety_management|ship_security|maritime_labour)/,
    'Equipment and compliance',
  ],
  [
    /^(registered_owner|beneficial_owner|ism_|commercial_|technical_|operator_|group_|ownership_|purchase_|mortgage_|protection_and|hull_and|insured_)/,
    'Ownership',
  ],
  [
    /^(last_port|next_declared|estimated_arrival|current_cargo|cargo_|laden_|reported_|ais_|longest_ais)/,
    'Movement',
  ],
  [
    /^(sanctions|flag_changes|name_changes|ship_to_ship|dark_|high_risk|detention|casualty|crew_)/,
    'Risk',
  ],
];

/** The group of every key that matches no rule above. */
const DEFAULT_GROUP = 'Other';

/**
 * The order of the groups on the screen. **A guess at #46, and a separate list from the
 * precedence above**: a rule must be tested early and still be drawn late.
 *
 * The identity of the entity comes first, because it is what names the row the analyst opened.
 * The two groups that hold a person's own words come last: "Analyst notes" is hand-entered, and
 * "Other" is every key that no rule claims. Neither is evidence about the vessel itself, so
 * neither stands above it.
 *
 * Every group of `GROUP_RULES` must appear here. A group that is absent from this list is drawn
 * after every group that is present, in the precedence order, so nothing is ever dropped.
 */
const GROUP_ORDER: readonly string[] = [
  'Identity',
  'Dimensions',
  'Machinery',
  'Class and survey',
  'Equipment and compliance',
  'Ownership',
  'Movement',
  'Risk',
  'Analyst notes',
  DEFAULT_GROUP,
];

/** The control, from the shape of the value. The first guess of §3.2. */
function shapeOf(value: AttributeValue): ClaimValue {
  if (typeof value === 'boolean') {
    return { control: 'boolean', checked: value, text: value ? 'yes' : 'no' };
  }
  if (typeof value === 'number') {
    return { control: 'number', text: String(value) };
  }
  if (typeof value === 'string') {
    if (DATE_ONLY.test(value)) return { control: 'date', text: value };
    if (value.length > NOTE_LENGTH || value.includes('\n')) return { control: 'note', text: value };
    return { control: 'text', text: value };
  }
  // M7 leaves a flat list of scalars, and nothing else. §4.2 joins it into the one box.
  return { control: 'list', text: value.join(', '), count: value.length };
}

/** §4.1, the four widths. The value decides, and the pane does not. */
function widthOf(value: ClaimValue): ClaimWidth {
  if (value.control === 'boolean') return 'short';
  if (value.control === 'date') return 'date';
  if (value.text.length <= SHORT_LENGTH) return 'short';
  if (value.text.length <= MEDIUM_LENGTH) return 'medium';
  return 'line';
}

/** The guess, in words for a reader. */
function controlWordOf(value: ClaimValue): string {
  switch (value.control) {
    case 'boolean':
      return 'yes or no';
    case 'number':
      return 'a number';
    case 'date':
      return 'a date';
    // A note is a text that is too long for one cell. The reader is told which one it got.
    case 'note':
      return 'a long text';
    case 'text':
      return 'text';
    case 'list':
      return `a list of ${value.count}`;
  }
}

function groupOf(key: string): string {
  for (const [pattern, group] of GROUP_RULES) {
    if (pattern.test(key)) return group;
  }
  return DEFAULT_GROUP;
}

/**
 * The order of two keys, by code point.
 *
 * **The defect this replaces:** the keys were sorted with `a.localeCompare(b)` and no locale.
 * The collation of `_` and of a digit is decided by ICU and by the locale of the machine, and
 * this order decides the order `./dossier` hands out the badge numbers. A second machine
 * therefore renumbered every badge, and the order of the rail and a `?src=` deep link both
 * follow those numbers. **Do not restore `localeCompare` with no locale.** A code point compare
 * needs no ICU at all and gives one order on every machine.
 */
function byCodePoint(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** The key, humanised. Sentence case, because the surface is sentence case everywhere. */
function labelOf(key: string): string {
  const words = key.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function readClaims(attrs: Attributes): readonly ClaimRow[] {
  const rows: readonly ClaimRow[] = Object.entries(attrs)
    // The third guess of §3.2: no order arrives, so the alphabet is the order inside a group.
    .sort(([a], [b]) => byCodePoint(a, b))
    .map(([key, attribute]) => {
      const value = shapeOf(attribute.v);
      return {
        key,
        label: labelOf(key),
        group: groupOf(key),
        value,
        controlWord: controlWordOf(value),
        width: widthOf(value),
        sources: attribute.src,
      };
    });

  // A group that `GROUP_ORDER` does not name is drawn after the ones it does, in the precedence
  // order. A claim is never dropped because a person forgot to add its group to one of the two
  // lists.
  const named = new Set(GROUP_ORDER);
  const rest = [...GROUP_RULES.map(([, group]) => group), DEFAULT_GROUP].filter(
    (group) => !named.has(group),
  );
  return [...GROUP_ORDER, ...rest].flatMap((group) => rows.filter((row) => row.group === group));
}
