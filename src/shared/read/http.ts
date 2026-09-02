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

export async function readRows(
  view: string,
  equals: Readonly<Record<string, string>> = {},
): Promise<readonly unknown[]> {
  const asked = new URL(view, address());
  for (const [column, value] of Object.entries(equals)) {
    asked.searchParams.set(column, `eq.${value}`);
  }

  const answer = await fetch(asked, { headers: { Accept: 'application/json' } });
  if (!answer.ok) {
    throw new Error(`The read API refused the ${view} list, and answered ${answer.status}.`);
  }

  const body: unknown = await answer.json();
  const rows = rowList.safeParse(body);
  if (!rows.success) {
    throw new Error(`The read API answered the ${view} list with something that is not a list.`);
  }
  return rows.data;
}
