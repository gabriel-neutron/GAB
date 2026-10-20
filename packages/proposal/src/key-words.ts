/** The words of one attribute key. `help` is null where the label says enough. */
export interface KeyWords {
  readonly label: string;
  readonly help: string | null;
}

const KNOWN: Readonly<Record<string, KeyWords>> = {
  v1_id: {
    label: 'Row in the v1 file',
    help: 'The row of this entity in the file of the first version.',
  },
  osm_id: { label: 'OpenStreetMap id', help: 'The identifier of this place in OpenStreetMap.' },
  source_urls: {
    label: 'Source addresses',
    help: 'The web addresses where the import found this entity.',
  },
  position_precision: {
    label: 'Position precision',
    help: 'How close the stored position is to the real place.',
  },
  imo: {
    label: 'IMO number',
    help: 'The seven-digit number of a ship in the register of the IMO.',
  },
  teu_capacity: {
    label: 'TEU capacity',
    help: 'The number of 20-foot containers the ship carries.',
  },
  coal_stock_t: { label: 'Coal stock (tonnes)', help: null },
  share_pct: { label: 'Share (%)', help: null },
};

const VALUE_HELP: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  position_precision: {
    exact: 'The position is on the real place.',
    approximate: 'The position is near the real place, and not on it.',
    inherited: 'The position is the position of a parent entity.',
  },
};

/** The rule for a key that the table does not hold (M11): each underscore becomes a space, and
 * the first letter becomes a capital. */
export function keyLabel(key: string): string {
  const words = key.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// Departure: three exports, one job. A key and a value of that key say one fact in the same words.

/** The label and the short help of an attribute key. A screen prints the key itself in a
 * secondary place. */
export function keyWords(key: string): KeyWords {
  return KNOWN[key] ?? { label: keyLabel(key), help: null };
}

/** The short help of a word that an attribute states, such as "approximate", or null. */
export function valueHelp(key: string, value: string): string | null {
  return VALUE_HELP[key]?.[value] ?? null;
}
