import { DECISION_OPS, WRITE_OPS } from '@gab/proposal/request';
import { LARGEST_UPLOAD_BODY } from '@gab/proposal/upload-limit';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { admitOwnSiteJson } from './admission.ts';
import { decide } from './decide.ts';
import { readPassages } from './passages.ts';
import type { Sessions } from './pool.ts';
import { sign } from './sign.ts';
import { uploadDocument, type ObjectDoor } from './upload.ts';

const STATUS = {
  signed: 200,
  decided: 200,
  refused: 422,
  missing: 404,
  blocked: 409,
  undecided: 409,
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

/** The nine doors, and one private read. No address here answers a GET, and the one read is a
 * POST of JSON from this site, so the browser of another site can neither send it nor read it. */
export const writeRoutes = (pool: Sessions, store: ObjectDoor): Hono => {
  const app = new Hono();
  app.use('/write/*', admitOwnSiteJson());
  app.use('/private/*', admitOwnSiteJson());

  // The text of a document is private, so the passage that an act cites reaches the review card
  // through the writer and never through the public read API.
  app.post('/private/passages', capped(LARGEST_BODY_BYTES), async (context) => {
    const read = await readPassages(pool, await context.req.text());
    return context.json(read.reply, read.status);
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

  // A file enters the record as a document and never as an act: it writes no proposal, and each
  // claim it holds is proposed later and cites it.
  app.post('/write/upload-document', capped(LARGEST_UPLOAD_BODY), async (context) => {
    const act = await uploadDocument(pool, store, await context.req.text());
    return context.json(act.reply, act.status);
  });

  return app;
};
