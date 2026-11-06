import { describe, expect, test } from 'vitest';

import { memoryStore } from './fetch-fixture.ts';
import { storeAnswer, type Answer } from './store-answer.ts';
import type { Session } from './tool.ts';

// A session that holds no document and records the values of the store statement.
const recording = (): { session: Session; stored: unknown[][] } => {
  const stored: unknown[][] = [];
  const session: Session = {
    query: (text, values) => {
      if (text.includes('put_fetched_document')) {
        stored.push(values);
        return Promise.resolve({ rows: [{ id: 'doc_0123456789ab', pages: 1 }] });
      }
      if (text.includes('WHERE d.sha256'))
        return Promise.resolve({
          rows:
            stored.length === 0
              ? []
              : [
                  {
                    id: 'doc_0123456789ab',
                    title: String(stored[0]?.[0]),
                    mime: 'application/pdf',
                    retrieved_at: '2026-10-19',
                    provider_id: null,
                  },
                ],
        });
      return Promise.resolve({ rows: [] });
    },
  };
  return { session, stored };
};

const answer = (given: Partial<Answer>): Answer => ({
  kind: 'url',
  bytes: new TextEncoder().encode('%PDF-1.7 bytes'),
  mime: 'application/pdf',
  uri: 'https://example.org/files/act.pdf',
  title: 'example.org/files/act.pdf',
  pages: ['COUNCIL REGULATION (EU) 2026/12\nof 3 May 2026'],
  day: '2026-10-19',
  ...given,
});

describe('the title and the type of a stored document', () => {
  test('a PDF with no title takes the first line of its text, and never a path', async () => {
    const { session, stored } = recording();
    const done = await storeAnswer(session, memoryStore(), answer({}));
    expect(stored[0]?.[0]).toBe('COUNCIL REGULATION (EU) 2026/12');
    expect(done.title).toBe('COUNCIL REGULATION (EU) 2026/12');
  });

  test('a path title with no usable line takes the name of the file, and never the path', async () => {
    const { session, stored } = recording();
    await storeAnswer(
      session,
      memoryStore(),
      answer({ title: 'example.org/files/ship-list.pdf', pages: ['  3 '] }),
    );
    expect(stored[0]?.[0]).toBe('ship list');
  });

  test('a readable title stays', async () => {
    const { session, stored } = recording();
    await storeAnswer(session, memoryStore(), answer({ title: 'Annual report 2025' }));
    expect(stored[0]?.[0]).toBe('Annual report 2025');
  });

  test('the type comes from the address and the title', async () => {
    const { session, stored } = recording();
    await storeAnswer(
      session,
      memoryStore(),
      answer({ uri: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R0012' }),
    );
    expect(stored[0]?.[10]).toBe('legal_act');
  });

  test('a type that a tool names wins over the rules', async () => {
    const { session, stored } = recording();
    await storeAnswer(session, memoryStore(), answer({ docType: 'report' }));
    expect(stored[0]?.[10]).toBe('report');
  });

  test('a document that no rule matches has the type other', async () => {
    const { session, stored } = recording();
    await storeAnswer(
      session,
      memoryStore(),
      answer({ uri: 'https://example.org/a', title: 'A note on a ship' }),
    );
    expect(stored[0]?.[10]).toBe('other');
  });
});

describe('a page of results of a search engine is a lead and not a source', () => {
  test.each([
    'https://www.google.com/search?q=ship',
    'https://www.bing.com/search?q=ship',
    'https://yandex.ru/search/?text=ship',
    'https://duckduckgo.com/?q=ship',
  ])('%s is refused, and nothing is written', async (uri) => {
    const { session, stored } = recording();
    const store = memoryStore();
    await expect(storeAnswer(session, store, answer({ uri }))).rejects.toThrow(/search/u);
    expect(stored).toStrictEqual([]);
    expect(store.puts).toStrictEqual([]);
  });
});

const largeAnswer = (bytes: number) => ({
  kind: 'url' as const,
  bytes: new Uint8Array(bytes),
  mime: 'text/csv',
  uri: 'https://stat.example/large.csv',
  title: 'A table',
  pages: ['id,name'],
  day: '2026-11-06',
});

const LARGE = 16 * 1024 * 1024 + 1;

// A session that answers each statement by its words, and logs the limits that it sets.
const loggedSession = (pinned: boolean) => {
  const limits: unknown[] = [];
  let stored = false;
  const session = {
    pinned,
    query: (text: string, values: unknown[]) => {
      if (text.includes('set_config')) {
        limits.push(values[0]);
        return Promise.resolve({ rows: [{ held: '30s' }] });
      }
      if (text.includes('put_fetched_document')) {
        stored = true;
        return Promise.resolve({ rows: [{ id: 'doc_a', pages: 1 }] });
      }
      return Promise.resolve({
        rows: stored
          ? [
              {
                id: 'doc_a',
                title: 'A table',
                mime: 'text/csv',
                retrieved_at: null,
                provider_id: null,
              },
            ]
          : [],
      });
    },
  };
  return { session, limits };
};

const objectStore = { put: () => Promise.resolve('raw/a') };

test('a large store on one connection takes a longer limit, and gives the old limit back', async () => {
  const { session, limits } = loggedSession(true);
  await storeAnswer(session, objectStore, largeAnswer(LARGE));
  expect(limits).toStrictEqual(['180s', '30s']);
});

test('a pool session and a small store keep the limit of the role', async () => {
  const pool = loggedSession(false);
  await storeAnswer(pool.session, objectStore, largeAnswer(LARGE));
  expect(pool.limits).toStrictEqual([]);
  const small = loggedSession(true);
  await storeAnswer(small.session, objectStore, largeAnswer(10));
  expect(small.limits).toStrictEqual([]);
});
