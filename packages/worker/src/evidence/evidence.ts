import { createHash } from 'node:crypto';

import { putClaimReading } from '@gab/tools/put-claim-reading';
import { callTool, type Session, type Tool } from '@gab/tools/tool';
import { z } from 'zod';

import {
  JobStop,
  type AgentContext,
  type AgentResult,
  type Refusal,
  type RunnerAgent,
} from '../agents.ts';
import { readNewestPages, type NewestPages } from '../pages.ts';
import { entryForClaim, PARSER_VERSION } from './parsers.ts';

/** The reader id of the checks. The key of each row of code holds it. */
export const EVIDENCE_NAME = 'evidence';
const VERSION = 'v1';

/** The one write of the checks before the door. A test gives a stub for it. */
export interface EvidenceTools {
  readonly putClaimReading: Tool;
}

export interface EvidenceOptions {
  readonly tools?: EvidenceTools;
}

const DEFAULT_TOOLS: EvidenceTools = { putClaimReading };

// The worker reads the proposals and the documents, and never the readings: no role but the owner
// reads them. The check door reads them as the owner.
const CLAIMS = `SELECT p.id::text AS id, p.op, p.payload, p.target_id::text AS target_id
  FROM public.proposals p
 WHERE $1::text::doc_id = ANY (p.src)
 ORDER BY p.created_at, p.id`;

const DOCUMENT = 'SELECT d.mime FROM public.documents d WHERE d.id = $1';

const LABELS =
  'SELECT e.id::text AS id, e.label FROM public.entities e WHERE e.id = ANY ($1::uuid[])';

const CHECK = `SELECT check_id::text AS check_id, held
  FROM public.run_evidence_checks($1::uuid, $2::uuid)`;

const claimRow = z.object({
  id: z.uuid(),
  op: z.string(),
  payload: z.record(z.string(), z.unknown()),
  target_id: z.uuid().nullable(),
});

type Claim = z.output<typeof claimRow>;

const checkRows = z
  .array(z.object({ check_id: z.uuid(), held: z.record(z.string(), z.string()) }))
  .max(1);

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex');

const codePoints = (text: string): number => Array.from(text).length;

const isOcr = (textSet: string): boolean => textSet.startsWith('tesseract:');

// The values of a claim that a page must hold: the label, each related label and each attribute
// value that is text or a number.
const valuesOf = async (context: AgentContext, claim: Claim): Promise<string[]> => {
  const values: string[] = [];
  const label = claim.payload['label'];
  if (typeof label === 'string') values.push(label);
  const ends = [claim.payload['src_id'], claim.payload['dst_id'], claim.target_id].filter(
    (one): one is string => typeof one === 'string',
  );
  if (ends.length > 0) {
    const rows = z
      .array(z.object({ id: z.string(), label: z.string() }))
      .parse((await context.db.query(LABELS, [ends])).rows);
    values.push(...rows.map((row) => row.label));
  }
  const attrs = claim.payload['attrs'];
  if (attrs !== null && typeof attrs === 'object')
    for (const held of Object.values(attrs)) {
      const value: unknown =
        held !== null && typeof held === 'object' && 'v' in held
          ? (held as { v: unknown }).v
          : undefined;
      for (const one of Array.isArray(value) ? value : [value])
        if (typeof one === 'string' || typeof one === 'number') values.push(String(one));
    }
  return values;
};

/** The span of an OCR page that holds the values of a claim: from the first value that it finds to
 * the end of the last one, on one page, in code points. Null when the page holds none of them. */
export const ocrSpanOf = (
  pages: NewestPages['pages'],
  values: readonly string[],
): { page: number; start: number; end: number } | null => {
  for (const { page, text } of pages) {
    const folded = text.toLowerCase();
    const found = values
      .map((value) => {
        const index = folded.indexOf(value.toLowerCase());
        return index < 0 ? null : { index, end: index + value.length };
      })
      .filter((one): one is { index: number; end: number } => one !== null);
    if (found.length === 0) continue;
    const from = Math.min(...found.map((one) => one.index));
    const to = Math.max(...found.map((one) => one.end));
    return { page, start: codePoints(text.slice(0, from)), end: codePoints(text.slice(0, to)) };
  }
  return null;
};

/** The checks of one stored document. Code reads each claim that cites the document, writes the
 * parser or OCR reading that it can make, and asks the check door for each result. No model is
 * asked. */
export const makeEvidenceAgent = (options: EvidenceOptions = {}): RunnerAgent => {
  const tools = options.tools ?? DEFAULT_TOOLS;

  const run = async (context: AgentContext): Promise<AgentResult> => {
    const session: Session = { query: (text, values) => context.db.query(text, values) };
    const refusals: Refusal[] = [];
    const document = context.job.documentId;

    const mime =
      z
        .array(z.object({ mime: z.string().nullable() }))
        .parse((await context.db.query(DOCUMENT, [document])).rows)[0]?.mime ?? null;
    const newest = await readNewestPages(context.db, document);
    const claims = z.array(claimRow).parse((await context.db.query(CLAIMS, [document])).rows);

    const write = async (claim: string, input: Record<string, unknown>): Promise<void> => {
      const read = await callTool(tools.putClaimReading, session, {
        job: context.job.id,
        claim,
        ...input,
      });
      if (!read.ok) refusals.push({ tool: tools.putClaimReading.name, reason: read.refusal });
    };

    let stop = false;
    for (const claim of claims) {
      if (newest !== null) {
        const label = typeof claim.payload['label'] === 'string' ? claim.payload['label'] : null;
        const firstPage = newest.pages[0];
        // A structured issuer entry: the parser reads the one entry that the claim names.
        const entry =
          firstPage === undefined || isOcr(newest.textSet)
            ? null
            : entryForClaim(firstPage.text, mime, label);
        if (entry !== null && firstPage !== undefined) {
          await write(claim.id, {
            textExtractor: newest.textSet,
            page: firstPage.page,
            start: entry.start,
            end: entry.end,
            modality: 'enacts',
            inputForm: entry.format,
            readerFingerprint: PARSER_VERSION,
            chunkHash: sha256(firstPage.text),
            idempotencyKey: sha256(
              JSON.stringify([claim.id, newest.textSet, entry.start, entry.end, PARSER_VERSION]),
            ),
            parsed: entry.fields,
            actEffect: entry.effect,
          });
        } else if (isOcr(newest.textSet)) {
          // The OCR text is the second reading of an image. Code finds the values of the claim in
          // it. The OCR text is also what the first reader read, so this row shows only that the
          // values stand in the OCR text: it is a weak second reading, and it claims no more.
          const span = ocrSpanOf(newest.pages, await valuesOf(context, claim));
          const page =
            span === null ? undefined : newest.pages.find((one) => one.page === span.page);
          if (span !== null && page !== undefined)
            await write(claim.id, {
              textExtractor: newest.textSet,
              page: span.page,
              start: span.start,
              end: span.end,
              modality: 'asserts',
              inputForm: 'ocr-text',
              readerFingerprint: newest.textSet,
              chunkHash: sha256(page.text),
              idempotencyKey: sha256(
                JSON.stringify([claim.id, newest.textSet, span.page, span.start, span.end]),
              ),
            });
        }
      }

      const [row] = checkRows.parse(
        (await context.db.query(CHECK, [context.job.id, claim.id])).rows,
      );
      // A claim with no first reading on this document gets no row, and the job goes on.
      if (row !== undefined && Object.values(row.held).includes('no_second_reading')) stop = true;
    }

    // With no second reading, the job never completes with one reading. The second job ended, so
    // a pause would come back for ever: the job stops, and each claim keeps its held row.
    if (stop) throw new JobStop('no_second_reading');
    return { refusals };
  };

  return {
    name: EVIDENCE_NAME,
    version: VERSION,
    kind: 'evidence_check',
    questionsPerJob: 0,
    tokenCap: 1,
    run,
  };
};
