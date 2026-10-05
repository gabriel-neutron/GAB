// The start of the server. The client talks over stdin and stdout, so every line of the log goes
// to stderr. The credentials come from the environment of the research workspace alone.

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import pg from 'pg';

import {
  assertSessionRole,
  CREDENTIALS_VARIABLE,
  researchCredentials,
  StartRefusal,
} from './role.ts';
import { createServer } from './server.ts';

const stop = (cause: unknown): never => {
  // A refusal is the sentence the operator needs. Any other fault can hold the URL, so only its
  // code goes out.
  if (cause instanceof StartRefusal) console.error(cause.message);
  else {
    const code =
      typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
    console.error(`the MCP server did not start${code === '' ? '' : ` (${code})`}`);
  }
  process.exit(1);
};

const start = async (): Promise<void> => {
  const url = researchCredentials(process.env[CREDENTIALS_VARIABLE]);
  const pool = new pg.Pool({ connectionString: url });
  pool.on('error', (fault) => {
    console.error(fault);
  });
  await assertSessionRole(pool);
  await createServer(pool).connect(new StdioServerTransport());
  console.error('the MCP server runs as gabriel_research over stdio');
};

await start().catch(stop);
