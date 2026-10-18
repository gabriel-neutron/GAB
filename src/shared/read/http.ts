// The one request to the read API. The address, the headers, the filter form, the status and
// the shape of the answer stay inside; a caller names a view and a value a column must equal.

import { z } from 'zod';

const rowList = z.array(z.unknown());

// The local compose file publishes the read API here, so the application runs with no
// configuration at all.
const LOOPBACK = 'http://127.0.0.1:3000';

// Vite replaces `import.meta.env` at build time, so an absent key is the empty string and never
// `undefined` in a built bundle. Whitespace comes from a copied example file.
function address(): string {
  const held: unknown = import.meta.env['VITE_API_URL'];
  const stated = typeof held === 'string' ? held.trim() : '';
  const chosen = stated === '' ? LOOPBACK : stated;
  if (URL.parse(chosen) === null) {
    throw new Error(
      `The read API address is not an address: ${chosen}. Set VITE_API_URL to the read service.`,
    );
  }
  return chosen.endsWith('/') ? chosen : `${chosen}/`;
}

/** The read service does not answer: nothing listens, the answer is a server fault or an absent
 * route, or the body is not JSON. The application then reads the files of its release. A refusal
 * of the request itself (a status 4xx other than 404) is a fault, and it is not this. */
export class ReadServiceDown extends Error {}

// A host that holds the connection open must not hold the page: the release files take over.
const ANSWER_WITHIN_MS = 5000;

export async function readRows(
  view: string,
  equals: Readonly<Record<string, string>> = {},
): Promise<readonly unknown[]> {
  const asked = new URL(view, address());
  for (const [column, value] of Object.entries(equals)) {
    asked.searchParams.set(column, `eq.${value}`);
  }

  let answer: Response;
  try {
    answer = await fetch(asked, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(ANSWER_WITHIN_MS),
    });
  } catch {
    throw new ReadServiceDown(`The read API does not answer the ${view} list.`);
  }
  if (!answer.ok) {
    const refusal = `The read API refused the ${view} list, and answered ${answer.status}.`;
    // 404 is a host with no such route, and 5xx is a service that fails. Both are no service.
    if (answer.status === 404 || answer.status >= 500) throw new ReadServiceDown(refusal);
    throw new Error(refusal);
  }

  let body: unknown;
  try {
    body = await answer.json();
  } catch {
    throw new ReadServiceDown(
      `The read API answered the ${view} list with something that is not JSON.`,
    );
  }
  const rows = rowList.safeParse(body);
  if (!rows.success) {
    throw new Error(`The read API answered the ${view} list with something that is not a list.`);
  }
  return rows.data;
}
