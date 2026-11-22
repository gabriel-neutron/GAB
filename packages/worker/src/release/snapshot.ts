import type { Queryable } from '../queryable.ts';

/** Runs the work in one read-only snapshot of the database, so each read of the work sees the
 * same record. The snapshot writes nothing, so it ends with a roll back. */
export const inOneSnapshot = async <T>(db: Queryable, work: () => Promise<T>): Promise<T> => {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  let result: T;
  try {
    result = await work();
  } catch (error) {
    // A failed roll back on a dead connection must not hide the error of the work.
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
  await db.query('ROLLBACK');
  return result;
};

const TIMEOUT_FORM = /^\d+(ms|s|min|h)$/;

/** The statement timeout of a long read command: the value of `GAB_STATEMENT_TIMEOUT` (a number
 * and a unit, such as `4h`), or the default of the command. */
export const statementTimeout = (
  fallback: string,
  env: Record<string, string | undefined> = process.env,
): string => {
  const given = env['GAB_STATEMENT_TIMEOUT'];
  if (given === undefined || given === '') return fallback;
  if (!TIMEOUT_FORM.test(given)) {
    throw new Error('GAB_STATEMENT_TIMEOUT needs a number and a unit: ms, s, min or h.');
  }
  return given;
};
