import {
  callTool,
  CheckFailure,
  type CheckVerdict,
  type Reach,
  type Session,
  type Tool,
  type ToolOutcome,
} from '@gab/tools/tool';
import { z } from 'zod';

import { checkBatch, recordChecks, type SecondCheck } from './second-check.ts';

const UNCHECKED = 'SELECT public.unchecked_acts($1::uuid[]) AS ids';

const uncheckedRow = z.array(z.object({ ids: z.array(z.uuid()) })).length(1);

const doorAnswer = z.object({
  proposals: z.array(z.object({ proposalId: z.uuid(), written: z.boolean() })),
});

// External constraint: PostgreSQL refuses a savepoint outside a transaction with this code. The
// session of the server writes with no transaction, and the session of a test holds one.
const NO_TRANSACTION = '25P01';

const codeOf = (cause: unknown): string | null =>
  typeof cause === 'object' && cause !== null && 'code' in cause && typeof cause.code === 'string'
    ? cause.code
    : null;

interface Trial {
  readonly keep: () => Promise<void>;
  readonly undo: () => Promise<void>;
}

// A trial is a savepoint inside a transaction that the caller holds, or a transaction of its own.
const startTrial = async (session: Session): Promise<Trial> => {
  try {
    await session.query('SAVEPOINT research_trial', []);
    return {
      keep: async () => {
        await session.query('RELEASE SAVEPOINT research_trial', []);
      },
      undo: async () => {
        await session.query('ROLLBACK TO SAVEPOINT research_trial', []);
      },
    };
  } catch (cause) {
    if (codeOf(cause) !== NO_TRANSACTION) throw cause;
  }
  await session.query('BEGIN', []);
  return {
    keep: async () => {
      await session.query('COMMIT', []);
    },
    undo: async () => {
      await session.query('ROLLBACK', []);
    },
  };
};

// A batch that the record holds whole, each act with its check, needs no paid call: the trial
// writes it with no check, and it is kept only when it wrote no act and each act has a check. Its
// answer is then the answer of the call. A refusal is the refusal of the call too. Any other batch
// is undone, and the caller checks it.
const alreadyChecked = async (
  tool: Tool,
  session: Session,
  raw: unknown,
  reach: Reach,
): Promise<ToolOutcome | null> => {
  const trial = await startTrial(session);
  try {
    const outcome = await callTool(tool, session, raw, reach);
    if (!outcome.ok) {
      await trial.undo();
      return outcome;
    }
    const { proposals } = doorAnswer.parse(outcome.output);
    if (proposals.every((one) => !one.written)) {
      const [row] = uncheckedRow.parse(
        (await session.query(UNCHECKED, [proposals.map((one) => one.proposalId)])).rows,
      );
      if (row?.ids.length === 0) {
        await trial.keep();
        return outcome;
      }
    }
  } catch (cause) {
    await trial.undo();
    throw cause;
  }
  await trial.undo();
  return null;
};

/** The propose tool of the research AI with the check by a second model family. A model reads
 * the batch before the write, and only a verdict that the passage does not support disputes an
 * item. After the write, a session of the checker role keeps each verdict as the check of its
 * act. A checker that fails or is not ready gives no dispute and no check, so the rules keep the
 * unit waiting, and the same batch sent again is checked again. A batch that the record holds
 * whole and checked costs no call. */
export const proposeChecked = async (
  tool: Tool,
  session: Session,
  raw: unknown,
  given: Reach | undefined,
  check: SecondCheck,
  readerFamily: string | null,
): Promise<ToolOutcome> => {
  const reach: Reach = { now: () => new Date(), ...given, checkMarks: 'refuted' };
  if (!check.ready)
    return callTool(tool, session, raw, {
      ...reach,
      check: () => Promise.reject(new CheckFailure(`the server has no checker: ${check.reason}`)),
    });

  const held = await alreadyChecked(tool, session, raw, reach);
  if (held !== null) return held;

  const writer = await check.setup.pool.connect();
  try {
    const verdicts = new Map<string, CheckVerdict>();
    const outcome = await callTool(tool, session, raw, {
      ...reach,
      check: async (items) => {
        for (const [ref, verdict] of await checkBatch(check.setup, writer, readerFamily, items))
          verdicts.set(ref, verdict);
        return verdicts;
      },
    });
    if (outcome.ok && readerFamily !== null)
      await recordChecks(writer, check.setup.checker, readerFamily, outcome.output, verdicts);
    return outcome;
  } finally {
    writer.release();
  }
};
