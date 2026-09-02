// One request to the read service. The address, the count header, the status and the error shape
// stay inside, so a test names a path, a verb and what it expects back.

import { z } from 'zod';

// The compose file publishes the read service here, and nothing reaches it from outside the
// machine.
const LOOPBACK = 'http://127.0.0.1:3000/';

const failureShape = z.object({ code: z.string(), message: z.string() });
const rowShape = z.array(z.unknown());

// PostgREST answers `0-26/27`, and `*/27` when the range is empty.
const TOTAL = /\/(\d+)$/;

export interface ReadApiAnswer {
  readonly status: number;
  readonly failure: { readonly code: string; readonly message: string } | null;
  readonly total: number | null;
  readonly rows: readonly unknown[];
}

interface Ask {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly count?: boolean;
}

const totalOf = (header: string | null): number | null => {
  const stated = header === null ? null : TOTAL.exec(header);
  const digits = stated?.[1];
  return digits === undefined ? null : Number(digits);
};

/** Asks the read service one question, and reads the answer as a status, a count and a body. */
export const askReadApi = async (path: string, asked: Ask = {}): Promise<ReadApiAnswer> => {
  const headers: Record<string, string> = { Accept: 'application/json', ...asked.headers };
  if (asked.count === true) headers['Prefer'] = 'count=exact';

  const answer = await fetch(new URL(path, LOOPBACK), {
    method: asked.method ?? 'GET',
    headers,
    ...(asked.body === undefined ? {} : { body: asked.body }),
  });

  const body: unknown = await answer.json().catch(() => null);
  const failure = failureShape.safeParse(body);
  const rows = rowShape.safeParse(body);

  return {
    status: answer.status,
    failure: failure.success ? { code: failure.data.code, message: failure.data.message } : null,
    total: totalOf(answer.headers.get('content-range')),
    rows: rows.success ? rows.data : [],
  };
};
