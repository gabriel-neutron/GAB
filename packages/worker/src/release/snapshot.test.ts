import { expect, test } from 'vitest';

import type { Queryable } from '../queryable.ts';
import { inOneSnapshot } from './snapshot.ts';

const recorder = () => {
  const said: string[] = [];
  const db: Queryable = {
    query: (text) => {
      said.push(text);
      return Promise.resolve({ rows: [] });
    },
  };
  return { said, db };
};

test('the work reads in one read-only snapshot that ends after it', async () => {
  const { said, db } = recorder();
  const got = await inOneSnapshot(db, async () => {
    await db.query('SELECT 1');
    return 'done';
  });
  expect(got).toBe('done');
  expect(said).toStrictEqual([
    'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY',
    'SELECT 1',
    'ROLLBACK',
  ]);
});

test('the snapshot ends also when the work fails', async () => {
  const { said, db } = recorder();
  await expect(inOneSnapshot(db, () => Promise.reject(new Error('a fault')))).rejects.toThrow(
    'a fault',
  );
  expect(said.at(-1)).toBe('ROLLBACK');
});
