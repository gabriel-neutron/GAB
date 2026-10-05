// The start of the server. The client talks over stdin and stdout, so every line of the log goes
// to stderr. The credentials come from the environment of the research workspace alone.

import { openStore, putObject } from '@gab/store';
import { endMetadata } from '@gab/tools/fetch-document';
import type { Reach } from '@gab/tools/tool';
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

// The read tools need no object store, so a workspace with no store credential still starts, and
// only the fetch tool refuses. The sentence of the store names no secret.
const reachOf = (): Reach | undefined => {
  try {
    const store = openStore();
    return { store: { put: (object) => putObject(store, object) }, now: () => new Date() };
  } catch (cause) {
    console.error(
      `fetch_document is off: ${cause instanceof Error ? cause.message : 'no object store'}`,
    );
    return undefined;
  }
};

// The fetch tool keeps an exiftool process, and it holds the event loop open until it ends.
const shutdown = (): void => {
  void endMetadata().finally(() => process.exit(0));
};

const start = async (): Promise<void> => {
  const url = researchCredentials(process.env[CREDENTIALS_VARIABLE]);
  const pool = new pg.Pool({ connectionString: url });
  pool.on('error', (fault) => {
    console.error(fault);
  });
  await assertSessionRole(pool);
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.stdin.once('end', shutdown);
  await createServer(pool, reachOf()).connect(new StdioServerTransport());
  console.error('the MCP server runs as gabriel_research over stdio');
};

await start().catch(stop);
