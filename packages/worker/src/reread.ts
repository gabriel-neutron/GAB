import { extractText } from '@gab/text';
import { htmlTitle } from '@gab/tools/fetch-document';
import { z } from 'zod';

import type { Queryable } from './queryable.ts';

// Departure: one command, one job. Before PR #416 the fetch tool read each HTML page as UTF-8, so a
// page in windows-1251 or koi8-r got a garbled text and a garbled title. The bytes in the raw store
// are correct. This module reads them again with the current extraction. It writes the corrected
// text as a new text set, because each citation names the set and the offsets that it cites, and
// a citation must stay valid. The newest set is the one that each reader reads.

// The same limit as the fetch tool gives to a title.
const MAX_TITLE = 500;

// The fetch tool stores a render under the title of its page and this end. The browser gives the
// render as a string, so its bytes are UTF-8, also when its meta element names another charset.
const RENDER_END = ' (rendered)';
const AS_UTF8 = 'text/html; charset=utf-8';

const DOCUMENTS = `SELECT d.id::text AS id, d.title, d.mime, d.uri, d.s3_key,
       public.newest_text_extractor(d.id::text) AS extractor
  FROM public.documents d
 WHERE d.s3_key IS NOT NULL
   AND lower(btrim(split_part(d.mime, ';', 1))) IN ('text/html', 'application/xhtml+xml')
 ORDER BY d.id`;

const PAGES = `SELECT t.page::int AS page, t.text FROM public.document_text t
  WHERE t.document_id = $1::text AND t.extractor = $2 ORDER BY t.page`;

// The offsets of a citation count code points, as substr does.
const CITED = `SELECT c.id::text AS citation, c.page::int AS page,
       substr(t.text, c.start + 1, c."end" - c.start) AS excerpt
  FROM public.citation c
  JOIN public.document_text t
    ON (t.document_id, t.extractor, t.page) = (c.doc_id, c.text_extractor, c.page)
 WHERE c.doc_id = $1::text
 ORDER BY c.page, c.start, c.id`;

// One statement is one transaction, so the text and the title of a document change together.
const WRITE = `SELECT
    CASE WHEN $2::jsonb IS NULL THEN 0 ELSE public.put_document_text($1, $2::jsonb, $3) END
      AS pages,
    CASE WHEN $5::text IS NULL THEN false ELSE public.correct_document_title($1, $4, $5) END
      AS titled`;

const documentRow = z.object({
  id: z.string(),
  title: z.string(),
  mime: z.string(),
  uri: z.string().nullable(),
  s3_key: z.string(),
  extractor: z.string().nullable(),
});

const pageRow = z.object({ page: z.number().int(), text: z.string() });
const citedRow = z.object({ citation: z.string(), page: z.number().int(), excerpt: z.string() });

type Stored = z.infer<typeof documentRow>;

export interface RereadDeps {
  readonly db: Queryable;
  /** The bytes of one object of the raw store. */
  readonly read: (key: string) => Promise<Uint8Array>;
  readonly now: () => Date;
}

/** One document whose text or title changes. */
export interface Changed {
  readonly document: string;
  readonly text: boolean;
  readonly title: { readonly from: string; readonly to: string } | null;
}

/** A citation whose excerpt the corrected text no longer holds. It stays as it is. */
export interface LostExcerpt {
  readonly citation: string;
  readonly document: string;
  readonly page: number;
}

export interface RereadReport {
  readonly dryRun: boolean;
  readonly read: number;
  /** The name of the new text set. */
  readonly extractor: string;
  readonly changed: readonly Changed[];
  readonly failed: readonly { readonly document: string; readonly reason: string }[];
  readonly lostExcerpts: readonly LostExcerpt[];
}

const clipped = (title: string): string => title.slice(0, MAX_TITLE);

const isRender = (row: Stored): boolean => row.title.endsWith(RENDER_END);

// Bytes that are valid UTF-8 gave a correct text to the old reading. A render is UTF-8 also when
// its end " (rendered)" was cut from a long title, and its meta can still name another charset. A
// page in windows-1251 or koi8-r with letters outside ASCII is never valid UTF-8.
const isUtf8 = (bytes: Uint8Array): boolean => {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
};

/** The type that the current reading uses: UTF-8 for a render and for valid UTF-8 bytes, else the
 * stored type, so the byte order mark or the meta element names the charset. */
const readingTypeOf = (row: Stored, bytes: Uint8Array): string =>
  isRender(row) || isUtf8(bytes) ? AS_UTF8 : row.mime;

// The name of the new set sorts after `text-1` and after an earlier run, so the newest set is
// this one also when two sets have the same time.
const extractorOf = (now: Date): string =>
  `text-1-reread-${now.toISOString().replace(/[-:]/gu, '').replace(/\.\d+/u, '')}`;

const reasonOf = (fault: unknown): string =>
  (fault instanceof Error ? fault.message : String(fault)).split('\n')[0]?.slice(0, 200) ?? '';

const samePages = (stored: readonly string[], fresh: readonly string[]): boolean =>
  stored.length === fresh.length && stored.every((text, at) => text === fresh[at]);

/** The title that the old reading gave and the title that the current reading gives, for each
 * address of a plain page. A render takes its title from its page. */
interface TitlePair {
  readonly from: string;
  readonly to: string;
}

const titlesOf = (bytes: Uint8Array, type: string): TitlePair | null => {
  const from = htmlTitle(bytes, AS_UTF8);
  const to = htmlTitle(bytes, type);
  return from === null || to === null ? null : { from: clipped(from), to: clipped(to) };
};

/** The corrected title, or null when the title stays. A title changes only when the row still holds
 * the title of the old reading, so a title that the operator gave stays. */
const correctedTitle = (row: Stored, pair: TitlePair | undefined | null): TitlePair | null => {
  if (pair === undefined || pair === null) return null;
  return row.title === pair.from && pair.from !== pair.to ? pair : null;
};

// The titles of a render: the pair of the page at its address whose old title the render holds.
// Two plain pages can have one address, when the page changed between two fetches.
const renderTitle = (row: Stored, pairs: readonly TitlePair[]): TitlePair | null => {
  const found = pairs
    .map((pair) => ({
      from: clipped(`${pair.from}${RENDER_END}`),
      to: clipped(`${pair.to}${RENDER_END}`),
    }))
    .find((pair) => pair.from === row.title);
  return correctedTitle(row, found);
};

/** Reads each stored HTML document again, and corrects its text and its title when they change. A
 * dry run writes nothing. */
export const rereadHtml = async (deps: RereadDeps, dryRun: boolean): Promise<RereadReport> => {
  const rows = z.array(documentRow).parse((await deps.db.query(DOCUMENTS)).rows);
  const extractor = extractorOf(deps.now());
  const changed: Changed[] = [];
  const failed: { document: string; reason: string }[] = [];
  const lostExcerpts: LostExcerpt[] = [];

  // The plain pages come first, so that a render finds the titles of its page.
  const ordered = [...rows.filter((row) => !isRender(row)), ...rows.filter(isRender)];
  const titles = new Map<string, TitlePair[]>();

  for (const row of ordered) {
    let pages: readonly string[];
    let bytes: Uint8Array;
    let type: string;
    try {
      bytes = await deps.read(row.s3_key);
      type = readingTypeOf(row, bytes);
      pages = (await extractText(bytes, type)).pages;
    } catch (fault) {
      failed.push({ document: row.id, reason: reasonOf(fault) });
      continue;
    }

    let title: TitlePair | null;
    if (isRender(row)) {
      title = renderTitle(row, row.uri === null ? [] : (titles.get(row.uri) ?? []));
    } else {
      const pair = titlesOf(bytes, type);
      if (pair !== null && row.uri !== null)
        titles.set(row.uri, [...(titles.get(row.uri) ?? []), pair]);
      title = correctedTitle(row, pair);
    }

    const stored =
      row.extractor === null
        ? []
        : z.array(pageRow).parse((await deps.db.query(PAGES, [row.id, row.extractor])).rows);
    // A page with no text is stored when its render holds the text. Its text stays, and only its
    // title can change.
    const text =
      pages.join('').trim() !== '' &&
      !samePages(
        stored.map((one) => one.text),
        pages,
      );
    if (!text && title === null) continue;

    changed.push({ document: row.id, text, title });
    if (text) {
      const cited = z.array(citedRow).parse((await deps.db.query(CITED, [row.id])).rows);
      for (const one of cited)
        if (!(pages[one.page - 1] ?? '').includes(one.excerpt))
          lostExcerpts.push({ citation: one.citation, document: row.id, page: one.page });
    }
    if (dryRun) continue;
    await deps.db.query(WRITE, [
      row.id,
      text ? JSON.stringify(pages) : null,
      extractor,
      title?.from ?? null,
      title?.to ?? null,
    ]);
  }

  return { dryRun, read: rows.length - failed.length, extractor, changed, failed, lostExcerpts };
};

/** The lines that the command prints. */
export const reportLines = (report: RereadReport): string[] => {
  const verb = report.dryRun ? 'would change' : 'changed';
  const lines: string[] = [];
  for (const one of report.changed) {
    const what = [one.text ? 'text' : null, one.title === null ? null : 'title']
      .filter((word) => word !== null)
      .join(' and ');
    lines.push(`${verb} the ${what} of document ${one.document}`);
    if (one.title !== null) lines.push(`  title "${one.title.from}" -> "${one.title.to}"`);
  }
  for (const one of report.failed)
    lines.push(`could not read document ${one.document}: ${one.reason}`);
  for (const one of report.lostExcerpts)
    lines.push(
      `check citation ${one.citation} of document ${one.document}, page ${String(one.page)}: ` +
        'the corrected text does not hold its excerpt. The citation stays on the old text.',
    );
  lines.push(
    `${report.dryRun ? 'Dry run: ' : ''}${String(report.read)} HTML documents read, ` +
      `${String(report.changed.length)} ${report.dryRun ? 'to change' : 'changed'}, ` +
      `${String(report.failed.length)} not read.` +
      (report.changed.some((one) => one.text) && !report.dryRun
        ? ` The new text set is ${report.extractor}.`
        : ''),
  );
  return lines;
};
