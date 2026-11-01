import { readSource, type Source } from './parity';

/** The counts of the record that the final text gives, and the date it gives them. */
export interface RecordCounts {
  /** The day of the counts, at midnight UTC. */
  readonly date: Date;
  readonly entities: number;
  readonly critical: number;
  /** The text says "at least" this count. */
  readonly official: number;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const number = (text: string, pattern: RegExp, name: string): number => {
  const found = pattern.exec(text)?.[1];
  if (found === undefined) throw new Error(`The final text gives no count of ${name}.`);
  return Number(found.replace(/,/g, ''));
};

/** Read the record counts from the body of the final English text. The sentences are those of
 * the method part and of the annex; a change of these sentences stops the build. */
export function recordCounts(source: Source): RecordCounts {
  const { body } = readSource(source);
  const method = (body.get('method-chronology') ?? []).join(' ');
  const annex = (body.get('annex-method') ?? []).join(' ');
  const day = /On (\d+) (\w+) (\d{4}), the database holds/.exec(annex);
  const month = MONTHS.indexOf(day?.[2] ?? '');
  if (day === null || month < 0) throw new Error('The final text gives no date of the counts.');
  return {
    date: new Date(Date.UTC(Number(day[3]), month, Number(day[1]))),
    entities: number(annex, /the database holds ([\d,]+) entities/, 'entities'),
    critical: number(method, /In total, ([\d,]+) nodes are critical/, 'critical nodes'),
    official: number(
      method,
      /For at least ([\d,]+) of them, the three conditions rest on a document from an official issuer/,
      'nodes with an official source',
    ),
  };
}
