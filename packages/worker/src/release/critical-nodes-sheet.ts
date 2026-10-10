import { CsvFault, readCsv } from '@gab/tools/csv';

/** The sheet of the candidate nodes is refused. The message names the line to correct. */
export class CriticalNodesSheetFault extends Error {}

/** A condition that the operator ticks in the sheet. The record gives condition (a). */
export type SheetCondition = 'b' | 'c';

/** One row of the sheet, with the line of the file that holds it. */
export interface SheetRow {
  readonly line: number;
  readonly nodeId: string;
  /** Null for a row that only names the candidate and its texts. */
  readonly condition: SheetCondition | null;
  readonly claimIds: readonly string[];
  readonly controller: string;
  readonly bypassPattern: string;
}

/** The columns of the sheet. The operator types them, so the how-to guide names them. */
export const SHEET_COLUMNS = [
  'node_id',
  'condition',
  'claim_ids',
  'controller',
  'bypass_pattern',
] as const;

type Column = (typeof SHEET_COLUMNS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

const refuse = (line: number, why: string): never => {
  throw new CriticalNodesSheetFault(
    `The sheet of the candidate nodes is refused. Line ${String(line)}: ${why}.`,
  );
};

const conditionOf = (text: string, line: number): SheetCondition | null => {
  const condition = text
    .trim()
    .toLowerCase()
    .replace(/^\((.)\)$/u, '$1');
  if (condition === '') return null;
  if (condition === 'b' || condition === 'c') return condition;
  if (condition === 'a')
    return refuse(line, 'condition (a) comes from the designations in the record, give b or c');
  return refuse(line, `give the condition b, c or nothing, not "${text}"`);
};

// A spreadsheet that saves in a local code page gives bytes that are not UTF-8, and a decoder
// that replaces them would put a wrong name in a public file.
const textOf = (sheet: Uint8Array | string): string => {
  if (typeof sheet === 'string') return sheet;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(sheet);
  } catch {
    throw new CriticalNodesSheetFault(
      'The sheet of the candidate nodes is refused: the sheet is not UTF-8, save it as CSV UTF-8.',
    );
  }
};

// The UUID part of a claim identifier is in lower case in the release, and a spreadsheet can give
// it in upper case.
const claimIdOf = (text: string): string => {
  const slash = text.indexOf('/');
  const head = slash < 0 ? text : text.slice(0, slash);
  return UUID.test(head.toLowerCase()) ? `${head.toLowerCase()}${text.slice(head.length)}` : text;
};

/** Reads the sheet of the candidate nodes: a CSV file in UTF-8 with a header of the five columns,
 * in any order, and one row for each candidate node and condition. A line that starts with `#` is
 * a note. The claim identifiers of a row are separated by spaces, commas or semicolons, and a claim
 * that a row cites twice counts once. A row can leave out its empty fields at the end. */
export const readCriticalNodesSheet = (sheet: Uint8Array | string): readonly SheetRow[] => {
  const text = textOf(sheet);
  const points = Array.from(text);
  const lineAt = (start: number): number =>
    1 + points.slice(0, start).filter((point) => point === '\n').length;

  let records;
  try {
    records = readCsv(text).filter((record) => !(record.fields[0] ?? '').startsWith('#'));
  } catch (fault) {
    if (!(fault instanceof CsvFault)) throw fault;
    throw new CriticalNodesSheetFault(
      `The sheet of the candidate nodes is not a valid CSV file: ${fault.message}.`,
    );
  }
  const [header, ...body] = records;
  if (header === undefined)
    throw new CriticalNodesSheetFault('The sheet of the candidate nodes has no header.');

  const names = header.fields.map((name) => name.trim());
  while (names.length > 1 && names.at(-1) === '') names.pop();
  const headerLine = lineAt(header.start);
  const [only] = names;
  if (names.length === 1 && only?.includes(';'))
    refuse(headerLine, 'the columns are separated by ";", save the sheet with commas');
  for (const name of names)
    if (!(SHEET_COLUMNS as readonly string[]).includes(name))
      refuse(headerLine, `the column "${name}" is not known, give ${SHEET_COLUMNS.join(', ')}`);
  for (const name of SHEET_COLUMNS)
    if (names.filter((one) => one === name).length !== 1)
      refuse(headerLine, `give the column ${name} once`);

  const seen = new Set<string>();
  return body.map((record) => {
    const line = lineAt(record.start);
    if (record.fields.slice(names.length).some((one) => one.trim() !== ''))
      refuse(line, `give ${String(names.length)} fields, not ${String(record.fields.length)}`);
    const field = (column: Column): string => (record.fields[names.indexOf(column)] ?? '').trim();

    const nodeId = field('node_id').toLowerCase();
    if (!UUID.test(nodeId)) refuse(line, 'give the entity identifier of the node in node_id');
    const condition = conditionOf(field('condition'), line);
    const claimIds = [
      ...new Set(
        field('claim_ids')
          .split(/[\s,;]+/u)
          .filter((one) => one !== '')
          .map(claimIdOf),
      ),
    ];
    if (condition === null && claimIds.length > 0)
      refuse(line, 'a row with claim identifiers gives its condition');
    const key = `${nodeId} ${condition ?? ''}`;
    if (condition !== null && seen.has(key))
      refuse(line, `the node ${nodeId} has a row for condition (${condition}) already`);
    seen.add(key);
    return {
      line,
      nodeId,
      condition,
      claimIds,
      controller: field('controller'),
      bypassPattern: field('bypass_pattern'),
    };
  });
};
