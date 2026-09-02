import { WRITE_OPS } from '@gab/proposal/request';
import { Hono } from 'hono';
import type { Pool } from 'pg';

import { admitOwnSiteJson } from './admission.ts';
import { sign } from './sign.ts';
import type { VocabularyReader } from './vocabulary.ts';

const STATUS = {
  signed: 200,
  refused: 422,
  missing: 404,
  blocked: 409,
  undecided: 409,
  unavailable: 503,
} as const;

/** The five doors. No address here answers a GET: the writer serves no read and returns no row. */
export const writeRoutes = (pool: Pool, vocabulary: VocabularyReader): Hono => {
  const app = new Hono();
  app.use('/write/*', admitOwnSiteJson());

  for (const op of WRITE_OPS)
    app.post(`/write/${op.replaceAll('_', '-')}`, async (context) => {
      const act = await sign(pool, vocabulary, op, await context.req.text());
      return context.json(act.reply, STATUS[act.outcome]);
    });

  return app;
};
