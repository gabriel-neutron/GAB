// The parser never changes the text of a field and drops nothing in silence: a missing field and
// an unknown field name are reported on the block.

/** The eight fields that each kept block holds. */
export const CLAIM_FIELDS = [
  'Énoncé',
  'Chiffre',
  'Source',
  'Nature de la mesure',
  'ADMIRALTY',
  'Licence',
  'Limite',
  'Rail',
] as const;

/** The fields that a reviewed block adds. They are known, and never required. */
export const REVIEW_FIELDS = ['Correction appliquée', 'Révision', 'Verdict'] as const;

export interface ClaimField {
  /** The name as the file spells it. */
  readonly name: string;
  /** The text after the name, and each line that follows it up to the next field. */
  readonly text: string;
  readonly line: number;
}

export interface ClaimBlock {
  readonly claimId: string;
  readonly file: string;
  readonly firstLine: number;
  readonly lastLine: number;
  /** The lines of the block as the file holds them, from the heading to the last line of text. */
  readonly lines: readonly string[];
  readonly fields: readonly ClaimField[];
  readonly deleted: boolean;
  readonly reason: string | null;
  /** The required fields that the block lacks. A deleted block keeps its reason only. */
  readonly missing: readonly string[];
  /** The field names that are neither required nor review fields. Their text stays in the block. */
  readonly unknown: readonly string[];
}

const keyOf = (name: string): string => name.normalize('NFC').toLowerCase();

const KNOWN: ReadonlySet<string> = new Set([...CLAIM_FIELDS, ...REVIEW_FIELDS].map(keyOf));

// A field that can say that the block is deleted, and the words that say it. The word must open
// the value, so a sentence that only mentions a deletion does not delete the block.
const STATUS_FIELDS: ReadonlySet<string> = new Set(
  ['Verdict', 'Statut', 'Status', 'Suppression', 'Supprimé'].map(keyOf),
);
const OPENS_WITH_DELETION = /^[^\p{L}]*(supprim|deleted)/iu;
const NAMES_DELETION = /(supprim|deleted)/iu;

const CLAIM_HEADING = /^###\s+[~*_]*(C-[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*)[~*_]*(.*)$/u;
const ANY_HEADING = /^#{1,3}\s/;

// Three spellings of a field line: a bold name with a colon inside or after the bold, a plain
// known name with a colon, and a table row whose first cell is a known name.
const BOLD = /^\s*(?:[-*+]\s+)?\*\*(.+?)\*\*(.*)$/u;
const COLON_AT_END = /\s*[:：]\s*$/u;
const COLON_AT_START = /^\s*[:：]/u;
const PLAIN = /^\s*(?:[-*+]\s+)?([^:：|*]+?)\s*[:：]\s?(.*)$/u;
const TABLE_ROW = /^\s*\|\s*\**([^|*]+?)\**\s*\|(.*?)\|?\s*$/u;

const fieldOf = (line: string): { name: string; text: string } | undefined => {
  const bold = BOLD.exec(line);
  if (bold !== null) {
    const inside = bold[1] ?? '';
    const after = bold[2] ?? '';
    if (COLON_AT_END.test(inside))
      return { name: inside.replace(COLON_AT_END, '').trim(), text: after.trimStart() };
    if (COLON_AT_START.test(after))
      return { name: inside.trim(), text: after.replace(COLON_AT_START, '').trimStart() };
  }
  const plain = PLAIN.exec(line);
  if (plain !== null && KNOWN.has(keyOf(plain[1] ?? '')))
    return { name: (plain[1] ?? '').trim(), text: plain[2] ?? '' };
  const row = TABLE_ROW.exec(line);
  if (row !== null && KNOWN.has(keyOf(row[1] ?? '')))
    return { name: (row[1] ?? '').trim(), text: (row[2] ?? '').trim() };
  return undefined;
};

const lastTextLine = (lines: readonly string[]): number => {
  let at = lines.length - 1;
  while (at > 0 && (lines[at] ?? '').trim() === '') at -= 1;
  return at;
};

const blockOf = (
  claimId: string,
  tail: string,
  file: string,
  start: number,
  raw: readonly string[],
): ClaimBlock => {
  const lines = raw.slice(0, lastTextLine(raw) + 1);
  const fields: { name: string; text: string[]; line: number }[] = [];
  lines.slice(1).forEach((line, at) => {
    const field = fieldOf(line);
    if (field !== undefined)
      fields.push({ name: field.name, text: [field.text], line: start + at + 2 });
    else fields.at(-1)?.text.push(line);
  });
  const done: ClaimField[] = fields.map((field) => ({
    name: field.name,
    text: field.text.join('\n').trimEnd(),
    line: field.line,
  }));

  const statusField = done.find(
    (field) => STATUS_FIELDS.has(keyOf(field.name)) && OPENS_WITH_DELETION.test(field.text),
  );
  const headingTail = tail.trim();
  const deleted = statusField !== undefined || NAMES_DELETION.test(headingTail);
  const names = new Set(done.map((field) => keyOf(field.name)));
  return {
    claimId,
    file,
    firstLine: start + 1,
    lastLine: start + lines.length,
    lines,
    fields: done,
    deleted,
    reason: deleted ? (statusField?.text ?? headingTail) : null,
    missing: deleted ? [] : CLAIM_FIELDS.filter((name) => !names.has(keyOf(name))),
    unknown: done.map((field) => field.name).filter((name) => !KNOWN.has(keyOf(name))),
  };
};

/** Every block of one claims file, in the order of the file, a deleted block too. */
export const parseClaims = (text: string, file: string): readonly ClaimBlock[] => {
  const lines = text.split(/\r\n|\r|\n/);
  const blocks: ClaimBlock[] = [];
  let open: { claimId: string; tail: string; start: number } | undefined;
  const close = (end: number): void => {
    if (open !== undefined)
      blocks.push(blockOf(open.claimId, open.tail, file, open.start, lines.slice(open.start, end)));
    open = undefined;
  };
  lines.forEach((line, at) => {
    const heading = CLAIM_HEADING.exec(line);
    if (heading !== null) {
      close(at);
      open = { claimId: heading[1] ?? '', tail: heading[2] ?? '', start: at };
    } else if (ANY_HEADING.test(line)) close(at);
  });
  close(lines.length);
  return blocks;
};

/** The text of the document that stores one block. The same block and the same ids always give
 * the same text: the ids are sorted, and every line ends with a line feed. */
export const claimDocument = (block: ClaimBlock, documentIds: readonly string[]): string => {
  const ids = [...new Set(documentIds)].sort();
  return [
    `Claim: ${block.claimId}`,
    `File: ${block.file}`,
    `Sources: ${ids.length === 0 ? 'none' : ids.join(', ')}`,
    '',
    ...block.lines,
    '',
  ].join('\n');
};
