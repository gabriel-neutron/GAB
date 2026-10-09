// A web that answers from a table and opens no socket. Each request is recorded, so a test can
// prove which address a tool asked for and which header carried a key.

import type { Reach, Session, Web, WebAnswer, WebRequest } from './tool.ts';

export interface Asked {
  readonly url: URL;
  readonly headers: Readonly<Record<string, string>>;
  readonly request: WebRequest;
}

export type Answerer = (asked: Asked) => WebAnswer | Error;

export interface StubWeb extends Web {
  readonly asked: Asked[];
}

export const json = (value: unknown, status = 200): WebAnswer => ({
  status,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(value),
});

export const text = (
  body: string,
  status = 200,
  headers: Record<string, string> = {},
): WebAnswer => ({ status, headers, body });

export const stubWeb = (answer: Answerer, settings: Omit<Web, 'get'> = {}): StubWeb => {
  const asked: Asked[] = [];
  return {
    ...settings,
    asked,
    get: (url, request) => {
      const entry: Asked = { url: new URL(url), headers: request.headers ?? {}, request };
      asked.push(entry);
      const given = answer(entry);
      return given instanceof Error ? Promise.reject(given) : Promise.resolve(given);
    },
  };
};

const WEB_DAY = new Date('2026-10-05T10:00:00Z');

/** The reach of a test that may use the stub web and nothing else. */
export const webReach = (web: Web, now: () => Date = () => WEB_DAY): Reach => ({
  web,
  now,
  sleep: () => Promise.resolve(),
});

/** A session that fails the test when a tool reaches it. */
export const noSql: Session = {
  query: () => {
    throw new Error('the tool reached the database, and it had to answer without it');
  },
};

/** A session that records each statement and answers every one with the same rows. */
export const recordingSession = (
  rows: readonly unknown[] = [],
): Session & { readonly statements: string[] } => {
  const statements: string[] = [];
  return {
    statements,
    query: (statement) => {
      statements.push(statement);
      return Promise.resolve({ rows });
    },
  };
};

/** A session that knows a stored answer by the hash of its bytes, as the real database does. It
 * keeps the values of each write. */
export const hashDatabase = (): Session & { readonly stored: unknown[][] } => {
  const known = new Map<string, string>();
  const stored: unknown[][] = [];
  return {
    stored,
    query: (statement, values) => {
      if (statement.includes('WHERE d.sha256')) {
        const id = known.get(String(values[0]));
        return Promise.resolve({
          rows:
            id === undefined
              ? []
              : [{ id, title: 'held', mime: 'application/json', retrieved_at: '2026-10-05' }],
        });
      }
      stored.push(values);
      const id = `doc_${String(values[3]).slice(0, 12)}`;
      known.set(String(values[3]), id);
      return Promise.resolve({ rows: [{ id, pages: 1 }] });
    },
  };
};
