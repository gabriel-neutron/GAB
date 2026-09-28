import { openStore } from '@gab/store/bucket';
import type { RawStore } from '@gab/store/bucket';
import { afterEach, expect, test, vi } from 'vitest';

import { reconcileCorpus } from './reconcile.ts';

const X = '11111111-1111-4111-8111-111111111111';
const Y = '22222222-2222-4222-8222-222222222222';

interface CitedRow {
  readonly id: string;
  readonly s3_key: string;
}

const CITED_READ = 'SELECT id, s3_key FROM public.documents';

afterEach(() => {
  vi.unstubAllEnvs();
});

// Departure: the fake database answers the one read of the cited keys. A call that it has no
// answer for rejects, so no call passes in silence.
const databaseOf = (rows: readonly CitedRow[]) => {
  const texts: string[] = [];
  const query = async (text: string): Promise<{ rows: unknown[] }> => {
    texts.push(text);
    if (!text.startsWith(CITED_READ))
      return Promise.reject(new Error(`The fake database has no answer for: ${text}`));
    return Promise.resolve({ rows: [...rows] });
  };
  return { query, texts };
};

// Departure: a real client, stopped before it signs or sends, answers one page that holds the
// keys. Each other command rejects, so the fake cannot answer a call the run does not make.
const storeOf = (keys: readonly string[]): RawStore => {
  vi.stubEnv('RAW_STORE_ACCESS_KEY', 'offline');
  vi.stubEnv('RAW_STORE_SECRET_KEY', 'offline');
  const store = openStore();
  store.client.middlewareStack.add(
    (_next, context) => () => {
      if (context.commandName !== 'ListObjectsV2Command')
        return Promise.reject(
          new Error(`The fake store has no answer for: ${context.commandName}`),
        );
      const Contents = keys.map((Key) => ({ Key }));
      return Promise.resolve({ output: { $metadata: {}, Contents }, response: {} });
    },
    { step: 'initialize' },
  );
  return store;
};

test('each list names only its own side of the disagreement', async () => {
  const database = databaseOf([
    { id: X, s3_key: 'b' },
    { id: Y, s3_key: 'c' },
  ]);

  const found = await reconcileCorpus(database, storeOf(['a', 'b']));

  expect(found.objectsWithNoRow).toStrictEqual(['a']);
  expect(found.rowsWithNoObject).toStrictEqual([{ documentId: Y, key: 'c' }]);
  expect(database.texts).toHaveLength(1);
});
