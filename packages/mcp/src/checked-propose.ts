import {
  callTool,
  CheckFailure,
  type CheckVerdict,
  type Reach,
  type Session,
  type Tool,
  type ToolOutcome,
} from '@gab/tools/tool';

import {
  cannotWrite,
  checkBatch,
  recordChecks,
  type CheckerSession,
  type SecondCheck,
} from './second-check.ts';

const withFailure = (outcome: ToolOutcome, failure: string): ToolOutcome =>
  outcome.ok && typeof outcome.output === 'object' && outcome.output !== null
    ? { ok: true, output: { ...outcome.output, checkFailure: failure } }
    : outcome;

/** The propose tool of the research AI with the check by a second model family. A model reads
 * the batch before the write, in one call, and only a verdict that the passage does not support
 * disputes an item. After the write, a session of the checker role keeps each verdict as the
 * check of its act. A checker that fails, is not ready, or whose role cannot write gives no
 * dispute and no check: the batch is written, the rules keep the unit waiting, and the same batch
 * sent again is checked again. */
export const proposeChecked = async (
  tool: Tool,
  session: Session,
  raw: unknown,
  given: Reach | undefined,
  check: SecondCheck,
  readerFamily: string | null,
): Promise<ToolOutcome> => {
  const reach: Reach = { now: () => new Date(), ...given, checkMarks: 'refuted' };
  const failing = (failure: CheckFailure): Promise<ToolOutcome> =>
    callTool(tool, session, raw, { ...reach, check: () => Promise.reject(failure) });

  if (!check.ready) return failing(new CheckFailure(`the server has no checker: ${check.reason}`));

  // The session of the checker opens before the call of the model, so a wrong password spends
  // nothing.
  let writer: CheckerSession;
  try {
    writer = await check.setup.pool.connect();
  } catch (cause) {
    return failing(cannotWrite(cause));
  }
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
    if (!outcome.ok || readerFamily === null) return outcome;
    try {
      await recordChecks(writer, check.setup.checker, readerFamily, outcome.output, verdicts);
    } catch (cause) {
      return withFailure(outcome, cannotWrite(cause).message);
    }
    return outcome;
  } finally {
    writer.release();
  }
};
