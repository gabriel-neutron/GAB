import { createHash } from 'node:crypto';

import { extractText } from '@gab/text';
import { z } from 'zod';

import { FetchRefusal, guardedGet } from './fetch-guard.ts';
import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// External constraint: the Treasury publishes the SDN list as one CSV file at this address, and it
// answers 302 to a signed address of its object store. The signed address holds a token, so the
// document keeps the address of the Treasury and never the signed one. The file gives no date of
// its own, and the date of publication is the Last-Modified date of the answer.
export const SDN_CSV =
  'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV';

// Origin of the numbers: the file held 5.7 MB on 9 October 2026, and the server answers in some
// seconds. A cap of four times that size leaves room for growth.
const MAX_BYTES = 24 * 1024 * 1024;
const TIMEOUT_MS = 60_000;
const MAX_REDIRECTS = 3;

// The same cap as the excerpt of a proposal, so the excerpt is cited as it is given.
const MAX_EXCERPT = 600;

const outputShape = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  title: z.string(),
  url: z.string(),
  sha256: z.string(),
  publishedAt: z.string().nullable(),
  retrievedAt: z.string(),
  entry: z
    .strictObject({ entNum: z.number().int(), page: z.literal(1), excerpt: z.string() })
    .nullable(),
  notice: z.string().nullable(),
});

const dayOf = (date: string | null): string | null => {
  if (date === null) return null;
  const read = new Date(date);
  return Number.isNaN(read.getTime()) ? null : read.toISOString().slice(0, 10);
};

/** The line of one entry: the line of the file that starts with its number, clipped to the cap of
 * an excerpt. A line is a part of the page, so the clipped line is still a quote of it. */
export const entryLine = (page: string, entNum: number): string | null => {
  const start = `${String(entNum)},`;
  const at = page.startsWith(start) ? 0 : page.indexOf(`\n${start}`);
  if (at === -1) return null;
  const from = at === 0 ? 0 : at + 1;
  const end = page.indexOf('\n', from);
  const line = page.slice(from, end === -1 ? undefined : end).replace(/\r$/u, '');
  // The cap of a proposal counts UTF-16 units, and a clip never splits a character.
  let clipped = '';
  for (const character of line) {
    if (clipped.length + character.length > MAX_EXCERPT) break;
    clipped += character;
  }
  return clipped;
};

/** The tool on one address of the file. A test gives the address of a local server. */
export const ofacSdnAt = (address: string) =>
  defineTool({
    name: 'ofac_sdn',
    description:
      'Stores the official SDN list of the US Treasury (OFAC) as one document: the whole CSV ' +
      'file, with its SHA-256 hash and its date of publication. A file that is already stored ' +
      'comes back as "known". With entNum, it also gives the line of that entry in the stored ' +
      'file, as an excerpt to cite on page 1 of the document. Cite the entry in this file by ' +
      'its ent_num. The tool never stores one entry alone. Use sanctions_match to find a lead ' +
      'by name.',
    input: z.strictObject({
      entNum: z
        .number()
        .int()
        .min(1)
        .optional()
        .describe('The ent_num of one entry, the first column of the file.'),
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
          throw new ToolRefusal(`the Treasury gave no SDN list: ${fault.message}`);
        throw fault;
      }
      const mime = (got.contentType?.split(';')[0] ?? '').trim().toLowerCase();
      if (mime !== 'text/csv')
        throw new ToolRefusal(
          `the Treasury gave ${mime === '' ? 'no type' : mime} and not text/csv, so nothing is stored`,
        );
      const { pages } = await extractText(got.bytes, 'text/csv');
      const page = pages[0] ?? '';
      if (page.trim() === '')
        throw new ToolRefusal('the SDN list holds no text, so nothing is stored');

      const publishedAt = dayOf(got.lastModified);
      const day = reach.now().toISOString().slice(0, 10);
      const stored = await storeAnswer(session, reach.store, {
        kind: 'url',
        bytes: got.bytes,
        mime,
        uri: address,
        title: `OFAC SDN list (CSV), published ${publishedAt ?? 'on an unknown date'}`,
        pages,
        day,
      });
      const excerpt = input.entNum === undefined ? null : entryLine(page, input.entNum);
      return {
        document: stored.id,
        status: stored.status,
        title: stored.title,
        url: address,
        sha256: createHash('sha256').update(got.bytes).digest('hex'),
        publishedAt,
        retrievedAt: stored.retrieved_at ?? day,
        entry:
          input.entNum === undefined || excerpt === null
            ? null
            : { entNum: input.entNum, page: 1 as const, excerpt },
        notice:
          input.entNum !== undefined && excerpt === null
            ? `the stored file holds no entry ${String(input.entNum)}`
            : null,
      };
    },
  });

export const ofacSdn = ofacSdnAt(SDN_CSV);
