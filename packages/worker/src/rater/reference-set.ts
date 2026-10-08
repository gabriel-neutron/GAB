import { openBudget, openModel, type CallRecord, type Message, type Model } from '@gab/model';
import { z } from 'zod';

import type { Queryable } from '../queryable.ts';
import type { RaterConfig } from '../reader-config.ts';
import { recordModelCall } from '../runner.ts';

const AGENT = { name: 'reference-set', version: 'v1' };

// Origin of the numbers: the ticket asks for about thirty authors. The range keeps a build that
// is far from thirty out of the record, and the operator reads the set before the approval.
const LEAST = 20;
const MOST = 40;

const author = z.strictObject({
  name: z.string().trim().min(1),
  letter: z.enum(['A', 'B', 'C', 'D', 'E', 'F']),
  reason: z.string().trim().min(1),
  controller: z.string().trim().min(1).nullable(),
  party: z.boolean(),
});

/** The answer of the model: the reference set, each author with a letter and a reason. */
export const referenceAnswer = z
  .strictObject({ authors: z.array(author).min(LEAST).max(MOST) })
  .check((context) => {
    const names = context.value.authors.map((one) => one.name.replace(/\s+/gu, ' ').toLowerCase());
    if (new Set(names).size !== names.length)
      context.issues.push({ code: 'custom', message: 'two authors share one name', input: names });
    context.value.authors.forEach((one, index) => {
      if (one.party && one.controller === null)
        context.issues.push({
          code: 'custom',
          message: `${one.name}: a party to the conflict has a controller`,
          input: one,
          path: ['authors', index],
        });
      if (one.party && one.letter === 'A')
        context.issues.push({
          code: 'custom',
          message: `${one.name}: a party to the conflict is B at most`,
          input: one,
          path: ['authors', index],
        });
    });
  });

const row = z.object({
  name_key: z.string(),
  letter: z.string(),
  reason: z.string(),
  controller: z.string().nullable(),
  party: z.boolean(),
  approved: z.boolean(),
});

export type ReferenceRow = z.infer<typeof row>;

const READ =
  'SELECT name_key, letter::text, reason, controller, party, approved FROM public.reference_set()';
const STORE = `SELECT public.store_reference_author($1::text, $2::text, $3::text, $4::text,
  '{}'::text[], $5::text, $6::boolean)`;
const APPROVE = 'SELECT public.approve_reference_set() AS n';

/** The reference set as the record holds it, for the operator to read. */
export const readReferenceSet = async (app: Queryable): Promise<readonly ReferenceRow[]> =>
  z.array(row).parse((await app.query(READ)).rows);

/** The operator approves the set. It gives the number of authors that it approved. */
export const approveReferenceSet = async (app: Queryable): Promise<number> =>
  z.object({ n: z.number().int() }).parse((await app.query(APPROVE)).rows[0]).n;

export interface BuildDeps {
  /** The connection of the agent role: it records the call of the model. */
  readonly agent: Queryable;
  /** The connection of the operator role: it stores the set. The caller wraps it in one
   * transaction, so a set is stored whole or not at all. */
  readonly app: Queryable;
  readonly config: RaterConfig;
  /** The pinned model, made by the caller. */
  readonly language: Parameters<typeof openModel>[0];
  readonly prompt: string;
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
}

/** Asks the strongest model once for the reference set, and stores each author with its letter and
 * its reason. The set is stored but is not used until the operator approves it. A record that
 * holds a reference set refuses a second build. */
export const buildReferenceSet = async (deps: BuildDeps): Promise<readonly ReferenceRow[]> => {
  if ((await readReferenceSet(deps.app)).length > 0)
    throw new Error('The record holds a reference set already. It is built once.');

  const line: Model = openModel(deps.language, deps.config.model.line, {
    record: (call: CallRecord) => recordModelCall(deps.agent, AGENT, null, call),
    sleep: deps.sleep,
    now: deps.now,
  });
  const messages: Message[] = [
    { role: 'system', content: deps.prompt },
    {
      role: 'user',
      content: `Build the reference set of ${String(LEAST)} to ${String(MOST)} authors.`,
    },
  ];
  const answer = await line.ask({
    messages,
    shape: referenceAnswer,
    budget: openBudget(deps.config.tokenCap),
  });
  if (!answer.ok) throw new Error(`The model gave no reference set: ${answer.failure.reason}`);
  if ('call' in answer)
    throw new Error('The model answered with a tool call, and the build offers none.');

  for (const one of answer.value.authors)
    await deps.app.query(STORE, [
      one.name,
      one.letter,
      answer.served ?? deps.config.model.model,
      one.reason,
      one.controller,
      one.party,
    ]);
  return readReferenceSet(deps.app);
};
