import type { Queryable } from '../queryable.ts';

/** Runs the work in one read-only snapshot of the database, so each read of the work sees the
 * same record. The snapshot writes nothing, so it ends with a roll back. */
export const inOneSnapshot = async <T>(db: Queryable, work: () => Promise<T>): Promise<T> => {
  await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    return await work();
  } finally {
    await db.query('ROLLBACK');
  }
};
