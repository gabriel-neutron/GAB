import { z } from 'zod';

/** The one role the server runs as. Its grants hold no door that signs as the operator. */
const RESEARCH_ROLE = 'gabriel_research';

export const CREDENTIALS_VARIABLE = 'GAB_RESEARCH_DATABASE_URL';

/** A start that the server refuses, with the one sentence that says why. */
export class StartRefusal extends Error {}

const refusal = (named: string): StartRefusal =>
  new StartRefusal(`the MCP server runs only as ${RESEARCH_ROLE}; the credentials name ${named}`);

// The sentence names the role and nothing else of the credentials: not the host, not the
// password.
/** Returns the credentials when they name the research role, and throws a refusal if not. */
export const researchCredentials = (url: string | undefined): string => {
  if (url === undefined || url === '')
    throw refusal(`no role, because ${CREDENTIALS_VARIABLE} is empty or absent`);
  let user: string;
  try {
    user = decodeURIComponent(new URL(url).username);
  } catch {
    throw refusal(`no role, because ${CREDENTIALS_VARIABLE} is not a URL`);
  }
  if (user !== RESEARCH_ROLE) throw refusal(user === '' ? 'no role' : user);
  return url;
};

interface Released {
  query(text: string, values: unknown[]): Promise<{ readonly rows: readonly unknown[] }>;
  release(): void;
}

const sessionUser = z.array(z.object({ name: z.string() })).length(1);

// A URL can name one role and log in as another through a setting of the host, so the server
// asks the database who it is.
/** Throws a refusal when a session of the pool is not the research role. */
export const assertSessionRole = async (pool: { connect(): Promise<Released> }): Promise<void> => {
  const session = await pool.connect();
  try {
    const { rows } = await session.query('SELECT session_user::text AS name', []);
    const [row] = sessionUser.parse(rows);
    if (row?.name !== RESEARCH_ROLE) throw refusal(row?.name ?? 'no role');
  } finally {
    session.release();
  }
};
