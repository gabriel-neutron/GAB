import { createHash } from 'node:crypto';

import { extractText } from '@gab/text';
import { z } from 'zod';

import { FetchRefusal, guardedGet } from './fetch-guard.ts';
import { lineExcerpt } from './line-excerpt.ts';
import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// External constraint: the FCDO publishes the UK Sanctions List as one CSV file at this address,
// and serves it as application/octet-stream. So the tool knows the file by its first two lines and
// not by its type. The first line gives the date of the report.
export const UK_LIST_CSV = 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.csv';

// Origin of the numbers: the file held 50.2 MB on 9 October 2026, because an entry has a line for
// each of its names and addresses. A cap of four times that size leaves room for growth.
const MAX_BYTES = 200 * 1024 * 1024;
const TIMEOUT_MS = 120_000;
const MAX_REDIRECTS = 3;

const REPORT_LINE = /^\uFEFF?Report Date: (\d{2})-([A-Z][a-z]{2})-(\d{4})\r?$/u;
const HEADER_START = 'Last Updated,Unique ID,';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const outputShape = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  title: z.string(),
  url: z.string(),
  sha256: z.string(),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string(),
  entry: z
    .strictObject({ uniqueId: z.string(), page: z.literal(1), excerpt: z.string() })
    .nullable(),
});

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

const dayOf = (date: string | null): string | null => {
  if (date === null) return null;
  const read = new Date(date);
  return Number.isNaN(read.getTime()) ? null : read.toISOString().slice(0, 10);
};

const headerEnd = (page: string): number | null => {
  const first = page.indexOf('\n');
  if (first === -1 || !page.startsWith(HEADER_START, first + 1)) return null;
  const end = page.indexOf('\n', first + 1);
  return end === -1 ? page.length : end;
};

/** The first line of one entry, clipped to the cap of an excerpt. The unique identifier is the
 * second column, and the first column is a date with no comma and no quote. */
export const ukEntryLine = (page: string, uniqueId: string): string | null => {
  const needle = `,${uniqueId},`;
  let at = page.indexOf(needle, headerEnd(page) ?? 0);
  while (at !== -1) {
    const start = page.lastIndexOf('\n', at) + 1;
    if (!/[,"]/u.test(page.slice(start, at))) return lineExcerpt(page, start);
    at = page.indexOf(needle, at + 1);
  }
  return null;
};

/** The tool on one address of the file. A test gives the address of a local server. */
export const ukSanctionsListAt = (address: string) =>
  defineTool({
    name: 'uk_sanctions_list',
    description:
      'Stores the official UK Sanctions List of the FCDO as one document: the whole CSV file, ' +
      'with its SHA-256 hash and its date of publication. A file that is already stored comes ' +
      'back as "known". With uniqueId, it also gives the first line of that entry in the stored ' +
      'file, as an excerpt to cite on page 1 of the document, and it refuses an identifier that ' +
      'the file does not hold. Cite the entry in this file by its Unique ID. The tool never ' +
      'stores one entry alone. Use sanctions_match to find a lead by name.',
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
        if (fault instanceof FetchRefusal)
          throw new ToolRefusal(`the FCDO gave no UK Sanctions List: ${fault.message}`);
        throw fault;
      }
      const mime = 'text/csv';
      const { pages } = await extractText(got.bytes, mime);
      const page = pages[0] ?? '';
      if (!REPORT_LINE.test(firstLineOf(page)) || headerEnd(page) === null)
        throw new ToolRefusal(
          'the FCDO gave a file that is not the UK Sanctions List, so nothing is stored',
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
      const excerpt = input.uniqueId === undefined ? null : ukEntryLine(page, input.uniqueId);
      if (input.uniqueId !== undefined && excerpt === null)
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
        entry:
          input.uniqueId === undefined || excerpt === null
            ? null
            : { uniqueId: input.uniqueId, page: 1 as const, excerpt },
      };
    },
  });

export const ukSanctionsList = ukSanctionsListAt(UK_LIST_CSV);
