import { createHash } from 'node:crypto';

import { extractText } from '@gab/text';
import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { FetchRefusal, guardedGet } from './fetch-guard.ts';
import { CsvFault } from './csv.ts';
import { csvRows, type CsvRow } from './csv-rows.ts';
import { clippedExcerpt, dayOf } from './official-list.ts';
import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal, type Session } from './tool.ts';

// External constraint: the FCDO publishes the UK Sanctions List as one CSV file at this address,
// and serves it as application/octet-stream. So the tool knows the file by its first line and its
// header, and not by its type. The first line gives the date of the report.
export const UK_LIST_CSV = 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv';

// Origin of the numbers: the file held 50.2 MB on 9 October 2026, because an entry has a line for
// each of its names and addresses. A cap of four times that size leaves room for growth.
const MAX_BYTES = 200 * 1024 * 1024;
const TIMEOUT_MS = 120_000;
const MAX_REDIRECTS = 3;

const REPORT_START = /^\uFEFF?Report Date:/u;
const REPORT_LINE = /^\uFEFF?Report Date: (\d{2})-([A-Z][a-z]{2})-(\d{4})\r?$/u;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// External constraint: in the file of 8 October 2026, a long statement of reasons comes between
// the name of an entry and its date of designation, and the IMO number of a ship is near the end
// of its line. One clipped line loses both, so an entry gives two parts of one line: its identity
// up to the source of the designation, and its identifiers from the date of designation to the end.
const COLUMNS = [
  'Unique ID',
  'Name type',
  'Designation source',
  'Date Designated',
  'IMO number',
] as const;

type Column = (typeof COLUMNS)[number];

const PRIMARY = 'primary name';

const outputShape = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  title: z.string(),
  url: z.string(),
  sha256: z.string(),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string(),
  // Set when the FCDO refused the read and the answer comes from the stored file.
  liveFault: z.string().nullable(),
  entry: z
    .strictObject({
      uniqueId: z.string(),
      page: z.number().int().min(1),
      identity: z.string(),
      identifiers: z.string(),
    })
    .nullable(),
});

const NEWEST = `SELECT d.id::text AS id, d.title, d.uri, d.sha256, d.retrieved_at::text AS retrieved_at
    FROM public.documents d WHERE d.provider_id = 'uk_sanctions_list' AND d.uri IS NOT NULL AND d.sha256 IS NOT NULL
   AND d.retrieved_at IS NOT NULL
   ORDER BY d.retrieved_at DESC NULLS LAST, d.id DESC LIMIT 1`;

const NEWEST_PAGES = `SELECT t.text FROM public.document_text t
   WHERE t.document_id = $1::text AND t.extractor = public.newest_text_extractor($1::text)
   ORDER BY t.page`;

const newestRow = z.strictObject({
  id: z.string(),
  title: z.string(),
  uri: z.string(),
  sha256: z.string(),
  retrieved_at: z.string(),
});

const pageRow = z.strictObject({ text: z.string() });

const firstLineOf = (page: string): string => {
  const end = page.indexOf('\n');
  return page.slice(0, end === -1 ? undefined : end);
};

/** The day of the "Report Date" line at the top of the file, or null when the line is absent or
 * its date does not exist. */
export const reportDay = (page: string): string | null => {
  const match = REPORT_LINE.exec(firstLineOf(page));
  if (match === null) return null;
  const [, day = '', month = '', year = ''] = match;
  const index = MONTHS.indexOf(month);
  if (index === -1) return null;
  const date = new Date(Date.UTC(Number(year), index, Number(day)));
  if (date.getUTCDate() !== Number(day) || date.getUTCMonth() !== index) return null;
  return date.toISOString().slice(0, 10);
};

const isReportRow = (row: CsvRow): boolean => REPORT_START.test(row.fields[0]?.value ?? '');

/** The place of each column, read from the first row that is not the "Report Date" line. A stored
 * text may lack that line, because a ship-only extraction skips it. */
export const headerOf = (rows: Iterator<CsvRow>): Map<string, number> | null => {
  let header = rows.next();
  if (header.done !== true && isReportRow(header.value)) header = rows.next();
  if (header.done === true) return null;
  return new Map(header.value.fields.map((field, index) => [field.value, index]));
};

/** The first column that the tool reads and the header of the page lacks, or null. */
export const missingColumn = (page: string): Column | null => {
  const names = headerOf(csvRows(page)) ?? new Map<string, number>();
  return COLUMNS.find((column) => !names.has(column)) ?? null;
};

/** The two parts of the line of one entry: the line of its primary name, or its first line when
 * no line is the primary name. Each part is a quote of the page, clipped to the cap of an
 * excerpt. A later page of the file repeats the first line of page 1 and holds no header, so the
 * caller gives the columns of page 1. */
export const ukEntry = (
  page: string,
  uniqueId: string,
  columns?: ReadonlyMap<string, number>,
): { readonly identity: string; readonly identifiers: string } | null => {
  const rows = csvRows(page);
  const names = columns ?? headerOf(rows);
  if (names === null) return null;
  const at = (column: Column): number => names.get(column) ?? -1;
  const value = (row: CsvRow, column: Column): string => row.fields[at(column)]?.value ?? '';
  let chosen: CsvRow | undefined;
  for (const row of rows) {
    if (value(row, 'Unique ID') !== uniqueId) continue;
    chosen ??= row;
    if (value(row, 'Name type').toLowerCase() === PRIMARY) {
      chosen = row;
      break;
    }
  }
  if (chosen === undefined) return null;
  const sourceEnd = chosen.fields[at('Designation source')]?.end ?? chosen.end;
  const datedStart = chosen.fields[at('Date Designated')]?.start ?? chosen.end;
  return {
    identity: clippedExcerpt(page.slice(chosen.start, sourceEnd)),
    identifiers: clippedExcerpt(page.slice(datedStart, chosen.end)),
  };
};

// shortcut: the entry is read on the first page that holds a line of it. The other lines of the
// entry on a later page are not read; upgrade if a primary name falls on another page.
export const entryOf = (
  pages: readonly string[],
  uniqueId: string | undefined,
  document: string,
) => {
  if (uniqueId === undefined) return null;
  try {
    const columns = headerOf(csvRows(pages[0] ?? '')) ?? undefined;
    for (const [index, page] of pages.entries()) {
      const found = ukEntry(page, uniqueId, index === 0 ? undefined : columns);
      if (found !== null) return { ...found, page: index + 1 };
    }
    return null;
  } catch (fault) {
    if (fault instanceof CsvFault)
      throw new ToolRefusal(
        `the UK Sanctions List (document ${document}) holds a quote that never closes, so no ` +
          'entry is read',
      );
    throw fault;
  }
};

/** The newest stored file of the UK list, read page by page, or null when none is stored. */
const storedList = async (session: Session) => {
  const [row] = await rowsOf(session, newestRow, NEWEST, []);
  if (row === undefined) return null;
  const pages = (await rowsOf(session, pageRow, NEWEST_PAGES, [row.id])).map((page) => page.text);
  return pages.length === 0 ? null : { row, pages };
};

/** The tool on one address of the file. A test gives the address of a local server. */
export const ukSanctionsListAt = (address: string) =>
  defineTool({
    name: 'uk_sanctions_list',
    description:
      'Stores the official UK Sanctions List of the FCDO as one document: the whole CSV file, ' +
      'with its SHA-256 hash and its date of publication. A file that is already stored comes ' +
      'back as "known". With uniqueId, it also gives two excerpts of the line of that entry (its ' +
      'primary name, or its first line): identity, up to the source of the designation, and ' +
      'identifiers, from the date of designation to the end of the line, with the IMO number of ' +
      'a ship. Cite them on the page that the entry gives (page 1 for a short file, a later page for a long one). It refuses an identifier that the file does ' +
      'not hold. Cite the entry in this file by its Unique ID. The tool never ' +
      'stores one entry alone. When the FCDO refuses the read, the tool reads the newest stored file ' +
      'and says why in liveFault. Use sanctions_match to find a lead by name.',
    input: z.strictObject({
      uniqueId: z
        .string()
        .regex(/^[A-Z0-9]{1,20}$/u)
        .optional()
        .describe('The Unique ID of one entry, the second column of the file, such as RUS0001.'),
    }),
    output: outputShape,
    async run(session, input, reach) {
      if (reach?.store === undefined)
        throw new ToolRefusal('this surface gives no object store, so it stores no list');
      let got;
      try {
        got = await guardedGet(address, {
          maxBytes: MAX_BYTES,
          timeoutMs: reach.fetchTimeoutMs ?? TIMEOUT_MS,
          maxRedirects: MAX_REDIRECTS,
          ask: { accept: 'text/csv' },
          ...(reach.lookup === undefined ? {} : { lookup: reach.lookup }),
          ...(reach.refuses === undefined ? {} : { refuses: reach.refuses }),
        });
      } catch (fault) {
        if (!(fault instanceof FetchRefusal)) throw fault;
        // Only an answer of the server falls back. A guard refusal (address, size, time) stays.
        const liveFault = `the FCDO gave no UK Sanctions List: ${fault.message}`;
        // A refused read must not hide a file that the record holds already.
        const stored = fault.fault?.kind === 'status' ? await storedList(session) : null;
        if (stored === null) throw new ToolRefusal(liveFault);
        const { row, pages } = stored;
        const entry = entryOf(pages, input.uniqueId, row.id);
        const publishedAt = reportDay(pages[0] ?? '');
        if (input.uniqueId !== undefined && entry === null)
          throw new ToolRefusal(
            `${liveFault}; the stored UK Sanctions List of ${publishedAt ?? 'an unknown date'} ` +
              `(document ${row.id}) holds no entry ${input.uniqueId}`,
          );
        return {
          document: row.id,
          status: 'known' as const,
          title: row.title,
          url: row.uri,
          sha256: row.sha256,
          publishedAt,
          retrievedAt: row.retrieved_at,
          liveFault,
          entry:
            input.uniqueId === undefined || entry === null
              ? null
              : { uniqueId: input.uniqueId, ...entry },
        };
      }
      const mime = 'text/csv';
      const { pages } = await extractText(got.bytes, mime);
      const page = pages[0] ?? '';
      if (!REPORT_START.test(firstLineOf(page)))
        throw new ToolRefusal(
          'the FCDO gave a file that is not the UK Sanctions List, so nothing is stored',
        );
      let missing;
      try {
        missing = missingColumn(page);
      } catch (fault) {
        if (fault instanceof CsvFault)
          throw new ToolRefusal('the FCDO gave a file that is not CSV, so nothing is stored');
        throw fault;
      }
      if (missing !== null)
        throw new ToolRefusal(
          `the UK Sanctions List has no column "${missing}", so nothing is stored`,
        );

      const publishedAt = reportDay(page) ?? dayOf(got.lastModified);
      const day = reach.now().toISOString().slice(0, 10);
      const stored = await storeAnswer(session, reach.store, {
        kind: 'url',
        bytes: got.bytes,
        mime,
        uri: address,
        title: `UK Sanctions List (CSV), published ${publishedAt ?? 'on an unknown date'}`,
        pages,
        day,
        provider: 'uk_sanctions_list',
      });
      const entry = entryOf(pages, input.uniqueId, stored.id);
      if (input.uniqueId !== undefined && entry === null)
        throw new ToolRefusal(
          `the UK Sanctions List of ${publishedAt ?? 'an unknown date'} (document ${stored.id}) ` +
            `holds no entry ${input.uniqueId}`,
        );
      return {
        document: stored.id,
        status: stored.status,
        title: stored.title,
        url: address,
        sha256: createHash('sha256').update(got.bytes).digest('hex'),
        publishedAt,
        retrievedAt: stored.retrieved_at ?? day,
        liveFault: null,
        entry:
          input.uniqueId === undefined || entry === null
            ? null
            : { uniqueId: input.uniqueId, ...entry },
      };
    },
  });

export const ukSanctionsList = ukSanctionsListAt(UK_LIST_CSV);
