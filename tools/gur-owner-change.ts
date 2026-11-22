// Replay of the report count: of the designated ships in the archived GUR pages, how many have an
// owner or manager that changed strictly after the designation. Run it from the main checkout, where the
// database of the record runs: `node tools/gur-owner-change.ts`. It reads the record only, and prints the count and each IMO.
//
// The rule:
// - A page is one stored GUR ship page. If a page has more than one text, the longest text counts.
// - The designation date is the earliest date in a sentence of the page that says "sanctions" and
//   does not name the master, a person, a company or an owner. It is the earliest of all regimes.
// - The change dates are the dates of the lines "Ship Owner", "Commercial ship manager" and "Ship
//   Safety Management Manager". These are the current owner and managers, each with its start date.
// - A date with no day covers a whole month. A change counts only if all its days are after all
//   the days of the designation: the same day, or the same month, does not count.
// - A "dated" ship has a designation date and at least one change date.

import { execFileSync } from 'node:child_process';
import { argv } from 'node:process';

export interface Span {
  first: string;
  last: string;
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

const pad = (n: number): string => String(n).padStart(2, '0');

const lastDay = (year: number, month: number): number =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const span = (year: number, month: number, day?: number): Span => ({
  first: `${year}-${pad(month)}-${pad(day ?? 1)}`,
  last: `${year}-${pad(month)}-${pad(day ?? lastDay(year, month))}`,
});

const NAME = MONTHS.join('|');
const WORDED = new RegExp(`\\b(${NAME})(?: (\\d{1,2}),)? (\\d{4})\\b`, 'g');
const NOT_VESSEL = /\b(master|captain|crew|person|company|entity|owner|manager|director)\b/i;

/** The earliest designation, from the prose of one page. */
export const designation = (text: string): Span | undefined => {
  const spans: Span[] = [];
  for (const sentence of text.split(/\n+|(?<=[.!?])\s+/)) {
    if (!/sanctions/i.test(sentence) || NOT_VESSEL.test(sentence)) continue;
    for (const [, name, day, year] of sentence.matchAll(WORDED)) {
      spans.push(
        span(
          Number(year),
          MONTHS.indexOf(name ?? '') + 1,
          day === undefined ? undefined : Number(day),
        ),
      );
    }
  }
  return spans.sort((a, b) => a.first.localeCompare(b.first))[0];
};

const ROLE =
  /^(Ship Owner|Commercial ship manager|Ship Safety Management Manager) \(IMO \/ Country \/ Date\)$/;

/** The start dates of the current owner and managers. */
export const changes = (text: string): Span[] => {
  const lines = text.split(/\n+/).map((line) => line.trim());
  const found: Span[] = [];
  lines.forEach((line, i) => {
    const date = ROLE.test(line)
      ? /\/ (?:(\d{2})\.)?(\d{2})\.(\d{4})\)\s*$/.exec(lines[i + 1] ?? '')
      : null;
    if (date !== null) {
      const [, day, month, year] = date;
      found.push(span(Number(year), Number(month), day === undefined ? undefined : Number(day)));
    }
  });
  return found;
};

/** `undefined` for an undated ship, else whether a change comes strictly after the designation. */
export const changedAfterDesignation = (text: string): boolean | undefined => {
  const designated = designation(text);
  const dates = changes(text);
  if (designated === undefined || dates.length === 0) return undefined;
  return dates.some((change) => change.first > designated.last);
};

export const imoOf = (text: string): string | undefined => /^IMO (\d{7})$/m.exec(text)?.[1];

const PAGES = `select row_to_json(t) from (select distinct on (d.uri) d.uri, dt.text
  from documents d join document_text dt on dt.document_id = d.id
  where d.uri ~ '^https://war-sanctions.gur.gov.ua/en/transport/shadow-fleet/[0-9]+$'
  order by d.uri, length(dt.text) desc, dt.extractor) t`;

if (argv[1]?.endsWith('gur-owner-change.ts')) {
  const out = execFileSync(
    'docker',
    [
      'compose',
      '-f',
      'infra/docker-compose.yml',
      'exec',
      '-T',
      '-e',
      'PGOPTIONS=-c default_transaction_read_only=on',
      'db',
      'psql',
      '-U',
      'gabriel',
      '-d',
      'gabriel',
      '-At',
      '-c',
      PAGES,
    ],
    { encoding: 'utf8', maxBuffer: 1 << 28 },
  );
  const ships = new Map<string, boolean>();
  for (const line of out.split('\n').filter(Boolean)) {
    const { text } = JSON.parse(line) as { text: string };
    const imo = imoOf(text);
    const changed = changedAfterDesignation(text);
    if (imo !== undefined && changed !== undefined)
      ships.set(imo, (ships.get(imo) ?? false) || changed);
  }
  const yes = [...ships].filter(([, changed]) => changed).map(([imo]) => imo);
  console.log(
    `${yes.length} of ${ships.size} dated ships (${Math.round((100 * yes.length) / ships.size)} %)`,
  );
  console.log(yes.sort().join('\n'));
}
