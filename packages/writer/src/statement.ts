import type { Sessions } from './pool.ts';
import { failureFrom, refusalFrom } from './refusal.ts';

/** What a request became when it did not reach its row. `refused` and `unavailable` wrote
 * nothing. `doubt` lost the answer of the database, and the act may stand in the record. */
export type Unwritten =
  | { readonly outcome: 'refused' | 'unavailable'; readonly reply: { readonly refusal: string } }
  | { readonly outcome: 'doubt'; readonly reply: { readonly doubt: string } };

/** The first row of one statement, or the reason it gave none. */
export type Answered =
  | { readonly outcome: 'answered'; readonly row: Readonly<Record<string, unknown>> | undefined }
  | Unwritten;

export const refused = (refusal: string): Unwritten => ({ outcome: 'refused', reply: { refusal } });

/** Run one statement of a door, in a transaction of its own. It raises nothing: a pool that
 * gives no client wrote nothing, and every other failure is a refusal or a doubt. */
export const runStatement = async (
  pool: Sessions,
  text: string,
  values: readonly unknown[],
): Promise<Answered> => {
  let client;
  try {
    client = await pool.connect();
  } catch (cause) {
    return { outcome: 'unavailable', reply: { refusal: refusalFrom(cause) } };
  }

  try {
    const found = await client.query(text, [...values]);
    return { outcome: 'answered', row: found.rows[0] };
  } catch (cause) {
    const failure = failureFrom(cause);
    if (failure.raised) return refused(failure.refusal);
    return { outcome: 'doubt', reply: { doubt: failure.doubt } };
  } finally {
    client.release();
  }
};
