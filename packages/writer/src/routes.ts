import { DECISION_OPS, WRITE_OPS } from '@gab/proposal/request';
import { LARGEST_UPLOAD_BODY } from '@gab/proposal/upload-limit';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { admitOwnSiteJson } from './admission.ts';
import { decide, decideBatch } from './decide.ts';
import { documentJobs, queueExtraction } from './extraction.ts';
import { readDocumentImage, type ObjectReader } from './image.ts';
import { readLeads, startLead } from './lead.ts';
import { readPassages } from './passages.ts';
import type { Sessions } from './pool.ts';
import { sign } from './sign.ts';
import { uploadDocument, type ObjectDoor } from './upload.ts';

// Departure: a doubt is the answer of the database that the writer lost on the way, and a gateway
// that lost an answer names it 502. The act may stand, so it is never a refusal.
const STATUS = {
  done: 200,
  refused: 422,
  doubt: 502,
  unavailable: 503,
} as const;

// Origin of the number: a large MultiPolygon of a border is some megabytes of JSON, and a body of
// some hundred megabytes fills the heap in JSON.parse and stops the process.
export const LARGEST_BODY_BYTES = 8 * 1024 * 1024;
const TOO_LARGE = 'the body is larger than the writer reads';
const PAYLOAD_TOO_LARGE = 413;

const doorOf = (op: string): string => `/write/${op.replaceAll('_', '-')}`;

// Departure: each door states its own cap. The upload carries a whole file, and one cap on every
// address would give that larger cap to every act.
const capped = (maxSize: number) =>
  bodyLimit({
    maxSize,
    onError: (context) => context.json({ refusal: TOO_LARGE }, PAYLOAD_TOO_LARGE),
  });

/** The doors of the operator, and four private reads: the status of the jobs of a document,
 * the passages that the acts cite, the image of a cited document, and the leads. The public read
 * never shows any of them. */
export const writeRoutes = (pool: Sessions, store: ObjectDoor, reader: ObjectReader): Hono => {
  const app = new Hono();
  app.use('/write/*', admitOwnSiteJson());
  app.use('/private/*', admitOwnSiteJson());

  // The text of a document is private, so the passage that an act cites reaches the review card
  // through the writer and never through the public read API.
  app.post('/private/passages', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readPassages(pool, await context.req.text());
    return context.json(read.reply, STATUS[read.outcome]);
  });

  // The raw store is private, so a cited image reaches the review card through the writer. The
  // browser must draw the bytes as the image type of the row and never sniff another type.
  app.post('/private/document-image', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readDocumentImage(pool, reader, await context.req.text());
    if (read.outcome !== 'done') return context.json(read.reply, STATUS[read.outcome]);
    return context.body(read.image.bytes, STATUS.done, {
      'Content-Type': read.image.mime,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    });
  });

  // The text of a lead can name a party before any source supports it, so it stays private.
  app.post('/private/leads', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readLeads(pool);
    return context.json(read.reply, STATUS[read.outcome]);
  });

  // The worker searches and stores the sources of a lead. It proposes nothing.
  app.post('/write/start-lead', capped(LARGEST_BODY_BYTES), async (context) => {
    const act = await startLead(pool, await context.req.text());
    return context.json(act.reply, STATUS[act.outcome]);
  });

  for (const op of WRITE_OPS)
    app.post(doorOf(op), capped(LARGEST_BODY_BYTES), async (context) => {
      const act = await sign(pool, op, await context.req.text());
      return context.json(act.reply, STATUS[act.outcome]);
    });

  // A decision writes no proposal: it names one that waits, and it opens the promotion door of
  // the record or the rejection door.
  for (const op of DECISION_OPS)
    app.post(doorOf(op), capped(LARGEST_BODY_BYTES), async (context) => {
      const act = await decide(pool, op, await context.req.text());
      return context.json(act.reply, STATUS[act.outcome]);
    });

  // The acts of a linked batch name each other, so the operator decides them as one unit.
  app.post('/write/decide-batch', capped(LARGEST_BODY_BYTES), async (context) => {
    const act = await decideBatch(pool, await context.req.text());
    return context.json(act.reply, STATUS[act.outcome]);
  });

  // A file enters the record as a document and never as an act: it writes no proposal, and each
  // claim it holds is proposed later and cites it.
  app.post('/write/upload-document', capped(LARGEST_UPLOAD_BODY), async (context) => {
    const act = await uploadDocument(pool, store, await context.req.text());
    return context.json(act.reply, act.status);
  });

  // A failed extraction is asked for again through the same door.
  app.post('/write/queue-extraction', capped(LARGEST_BODY_BYTES), async (context) => {
    const act = await queueExtraction(pool, await context.req.text());
    return context.json(act.reply, STATUS[act.outcome]);
  });

  // Departure: a read on a POST. The status is private to the operator, and the admission of a
  // JSON body from this site is the one guard the writer holds.
  app.post('/write/document-jobs', capped(LARGEST_BODY_BYTES), async (context) => {
    const act = await documentJobs(pool, await context.req.text());
    return context.json(act.reply, STATUS[act.outcome]);
  });

  return app;
};
