// The second reading of a structured issuer entry is code. Each parser reads the one stored entry
// or act that a claim cites, and never a whole list: nothing is loaded in bulk or fetched again.

/** The version of the parsers. A parser row names it, and a new rule is a new version. */
export const PARSER_VERSION = 'parsers-1';

export type ActEffect = 'insert' | 'replace' | 'delete';

export type ParsedFields = Readonly<Record<string, string>>;

export interface ParsedEntry {
  readonly format: 'sdn_csv' | 'eu_oj_xml' | 'annex_xlii';
  readonly fields: ParsedFields;
  readonly effect: ActEffect;
  /** The span of the entry in the stored page, in code points. */
  readonly start: number;
  readonly end: number;
}

const codePoints = (text: string): number => Array.from(text).length;

const spanOf = (page: string, index: number, length: number): { start: number; end: number } => {
  const start = codePoints(page.slice(0, index));
  return { start, end: start + codePoints(page.slice(index, index + length)) };
};

const IMO = /\bIMO\s*(\d{7})\b/u;
const MMSI = /\bMMSI\s*(\d{9})\b/u;

// ----------------------------------------------------------------------------- SDN.CSV ---

// The columns of one row of the OFAC file SDN.CSV, in order. The file writes -0- for no value.
const SDN_COLUMNS = [
  'ent_num',
  'name',
  'sdn_type',
  'program',
  'title',
  'call_sign',
  'vessel_type',
  'tonnage',
  'grt',
  'vessel_flag',
  'vessel_owner',
  'remarks',
] as const;

const EMPTY = '-0-';

/** The fields of one CSV line with quoted fields, or null when the line is not one row. */
export const csvFields = (line: string): string[] | null => {
  const fields: string[] = [];
  let at = 0;
  for (;;) {
    while (line[at] === ' ') at += 1;
    if (line[at] === '"') {
      let value = '';
      at += 1;
      for (;;) {
        const next = line.indexOf('"', at);
        if (next < 0) return null;
        value += line.slice(at, next);
        if (line[next + 1] === '"') {
          value += '"';
          at = next + 2;
          continue;
        }
        at = next + 1;
        break;
      }
      fields.push(value);
    } else {
      const next = line.indexOf(',', at);
      fields.push((next < 0 ? line.slice(at) : line.slice(at, next)).trim());
      at = next < 0 ? line.length : next;
    }
    while (line[at] === ' ') at += 1;
    if (at >= line.length) return fields;
    if (line[at] !== ',') return null;
    at += 1;
  }
};

/** One row of SDN.CSV, as the stored page of one entry. A listing inserts the entry. */
export const parseSdnRow = (page: string): ParsedEntry | null => {
  const line = page.replace(/\s+$/u, '');
  if (line.includes('\n')) return null;
  const values = csvFields(line);
  if (values?.length !== SDN_COLUMNS.length || !/^\d+$/u.test(values[0] ?? '')) return null;
  const fields: Record<string, string> = {};
  SDN_COLUMNS.forEach((column, index) => {
    const value = (values[index] ?? '').trim();
    if (value !== '' && value !== EMPTY) fields[column] = value;
  });
  const remarks = fields['remarks'] ?? '';
  const imo = IMO.exec(remarks)?.[1];
  const mmsi = MMSI.exec(remarks)?.[1];
  if (imo !== undefined) fields['imo'] = imo;
  if (mmsi !== undefined) fields['mmsi'] = mmsi;
  return { format: 'sdn_csv', fields, effect: 'insert', ...spanOf(page, 0, line.length) };
};

// ------------------------------------------------------------------------- EU OJ XML act ---

// The words of an amending act that set the effect of the entries that follow them. The words are
// the English of the Official Journal, and a fixture-sized list.
const EFFECT_WORDS: readonly (readonly [ActEffect, RegExp])[] = [
  ['delete', /\b(?:is|are)\s+deleted\b/iu],
  ['replace', /\b(?:is|are)\s+replaced\b/iu],
  ['insert', /\b(?:is|are)\s+(?:added|inserted)\b/iu],
];

// One entry of a list of vessels: a name in capitals, then its IMO number.
const ENTRY = /([A-Z0-9][A-Z0-9 .'-]*[A-Z0-9])\s*\(?\s*IMO\s*(\d{7})\s*\)?/gu;

const ELEMENT_TEXT = /<[^>]+>/gu;

/** Each entry of an amending act, with the effect of the instruction that stands before it. An
 * entry that the act deletes gives `delete`, whatever else the act inserts. */
export const parseOjAct = (page: string): ParsedEntry[] => {
  if (!/^\s*(?:<\?xml[^>]*>\s*)?</u.test(page)) return [];
  const entries = new Map<string, ParsedEntry>();
  let effect: ActEffect | null = null;
  // Each element text is read in the place where it stands, so each span is a span of the page.
  const texts = page.split(ELEMENT_TEXT);
  let index = 0;
  for (const text of texts) {
    const at = page.indexOf(text, index);
    index = at + text.length;
    // Each instruction sets the effect of the entries after it, in this text and in the next ones.
    const marks = EFFECT_WORDS.flatMap(([said, words]) =>
      [...text.matchAll(new RegExp(words.source, 'giu'))].map((match) => ({
        said,
        end: match.index + match[0].length,
      })),
    ).sort((left, right) => left.end - right.end);
    for (const match of text.matchAll(ENTRY)) {
      const before = marks.filter((mark) => mark.end <= match.index).at(-1);
      const current = before?.said ?? effect;
      if (current === null) continue;
      const name = (match[1] ?? '').trim();
      const imo = match[2] ?? '';
      const key = `${name}|${imo}`;
      if (entries.get(key)?.effect === 'delete') continue;
      entries.set(key, {
        format: 'eu_oj_xml',
        fields: { name, imo },
        effect: current,
        ...spanOf(page, at + match.index, match[0].length),
      });
    }
    effect = marks.at(-1)?.said ?? effect;
  }
  return [...entries.values()];
};

// ------------------------------------------------------------------------ annex XLII entry ---

const ANNEX_ENTRY = /^\s*\(?(\d+)[.)]\s+(.+?)[\s,;-]+IMO\s*(\d{7})\b.*$/gmu;

/** Each numbered entry of the annex of vessels, as the stored page of the annex holds it. An entry
 * of the annex is a listing, so it inserts the entry. */
export const parseAnnexEntries = (page: string): ParsedEntry[] => {
  if (!/annex\s+xlii/iu.test(page)) return [];
  return [...page.matchAll(ANNEX_ENTRY)].map((match) => ({
    format: 'annex_xlii' as const,
    fields: { entry: match[1] ?? '', name: (match[2] ?? '').trim(), imo: match[3] ?? '' },
    effect: 'insert' as const,
    ...spanOf(page, match.index, match[0].length),
  }));
};

// --------------------------------------------------------------------------- the choice ---

const fold = (text: string): string => text.toLowerCase().replace(/\s+/gu, ' ').trim();

/** The entry of a stored page that a claim names, or null when no parser reads the page or no
 * entry has the label of the claim. */
export const entryForClaim = (
  page: string,
  mime: string | null,
  label: string | null,
): ParsedEntry | null => {
  const type = (mime ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'text/csv') return parseSdnRow(page);
  const entries =
    type === 'application/xml' || type === 'text/xml' ? parseOjAct(page) : parseAnnexEntries(page);
  if (label === null) return null;
  return entries.find((entry) => fold(entry.fields['name'] ?? '') === fold(label)) ?? null;
};
