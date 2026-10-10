import { DECISION_OPS, MERGE_OPS, WRITE_OPS } from '@gab/proposal/request';
import { LARGEST_UPLOAD_BODY } from '@gab/proposal/upload-limit';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { admitOwnSiteJson } from './admission.ts';
import { decideAuthorName, readAuthorNames } from './author-names.ts';
import { decide } from './decide.ts';
import { documentJobs, queueExtraction } from './extraction.ts';
import { promoteGroup } from './group-action.ts';
import { readImoPairs } from './imo-pairs.ts';
import { readDocumentImage, type ObjectReader } from './image.ts';
import { readLeads, startLead } from './lead.ts';
import { merge } from './merge.ts';
import { readReviewDecided } from './review-decided.ts';
import { readReviewGroup, readReviewGroups } from './review-groups.ts';
import { readReviewUnits } from './review-units.ts';
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

/** The doors of the operator, and the private reads: the status of the jobs of a document,
 * the page of the review queue with its cited passages, the groups of the queue, the decided acts
 * with the reasons of the rejections, the image of a cited document, the leads, the names
 * that joined an author A or B, and the pairs of vessels with one IMO number. The public
 * read never shows any of them. */
export const writeRoutes = (pool: Sessions, store: ObjectDoor, reader: ObjectReader): Hono => {
  const app = new Hono();
  app.use('/write/*', admitOwnSiteJson());
  app.use('/private/*', admitOwnSiteJson());

  // A unit of the queue holds its cited passages and the reason of each dispute, so the queue
  // reaches the review page through the writer, one page at a time.
  app.post('/private/review-units', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readReviewUnits(pool, await context.req.text());
    return context.json(read.reply, STATUS[read.outcome]);
  });

  // The rail of the groups and the units of one group read the faults, which are private too.
  app.post('/private/review-groups', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readReviewGroups(pool);
    return context.json(read.reply, STATUS[read.outcome]);
  });

  app.post('/private/review-group', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readReviewGroup(pool, await context.req.text());
    return context.json(read.reply, STATUS[read.outcome]);
  });

  // A rejection keeps a reason and a note that only the operator reads.
  app.post('/private/review-decided', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readReviewDecided(pool, await context.req.text());
    return context.json(read.reply, STATUS[read.outcome]);
  });

  // The raw store is private, so a cited image reaches the review page through the writer. The
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

  // A name that joined an author can be a false join, so the operator decides it, and only here.
  app.post('/private/author-names', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readAuthorNames(pool);
    return context.json(read.reply, STATUS[read.outcome]);
  });

  // The pairs of vessels with one IMO number wait for a judgement of the operator on identity.
  app.post('/private/imo-pairs', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readImoPairs(pool);
    return context.json(read.reply, STATUS[read.outcome]);
  });

  app.post('/write/decide-author-name', capped(LARGEST_BODY_BYTES), async (context) => {
    const act = await decideAuthorName(pool, await context.req.text());
    return context.json(act.reply, STATUS[act.outcome]);
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

  // A decision writes no proposal: it names a unit that waits, or one relation of it.
  for (const op of DECISION_OPS)
    app.post(doorOf(op), capped(LARGEST_BODY_BYTES), async (context) => {
      const act = await decide(pool, op, await context.req.text());
      return context.json(act.reply, STATUS[act.outcome]);
    });

  // A merge and its undo are judgements of the operator on identity. Each one writes its act.
  for (const op of MERGE_OPS)
    app.post(doorOf(op), capped(LARGEST_BODY_BYTES), async (context) => {
      const act = await merge(pool, op, await context.req.text());
      return context.json(act.reply, STATUS[act.outcome]);
    });

  // The group action names the units that the screen showed, and it answers for each one.
  app.post('/write/promote-group', capped(LARGEST_BODY_BYTES), async (context) => {
    const act = await promoteGroup(pool, await context.req.text());
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
