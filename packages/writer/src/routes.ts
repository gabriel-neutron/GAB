import { DECISION_OPS, WRITE_OPS } from '@gab/proposal/request';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

import { admitOwnSiteJson } from './admission.ts';
import { decide } from './decide.ts';
import type { Sessions } from './pool.ts';
import { sign } from './sign.ts';

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

/** The eight doors. No address here answers a GET: the writer serves no read and returns no row. */
export const writeRoutes = (pool: Sessions): Hono => {
  const app = new Hono();
  app.use('/write/*', admitOwnSiteJson());
  app.use(
    '/write/*',
    bodyLimit({
      maxSize: LARGEST_BODY_BYTES,
      onError: (context) => context.json({ refusal: TOO_LARGE }, PAYLOAD_TOO_LARGE),
    }),
  );

  for (const op of WRITE_OPS)
    app.post(doorOf(op), async (context) => {
      const act = await sign(pool, op, await context.req.text());
      return context.json(act.reply, STATUS[act.outcome]);
    });

  // A decision writes no proposal: it names one that waits, and it opens the promotion door of
  // the record or the rejection door.
  for (const op of DECISION_OPS)
    app.post(doorOf(op), async (context) => {
      const act = await decide(pool, op, await context.req.text());
      return context.json(act.reply, STATUS[act.outcome]);
    });

  return app;
};
