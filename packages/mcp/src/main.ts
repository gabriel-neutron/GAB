// The start of the server. The client talks over stdin and stdout, so every line of the log goes
// to stderr. The credentials come from the environment of the research workspace alone.

import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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
import { webOf } from '@gab/tools/web';

const STOPPED =
  'the database does not answer; start the stack (docker compose -f infra/docker-compose.yml up -d)';

// The usual faults of a first start, each with the step that corrects it.
const START_FAULTS: Readonly<Record<string, string>> = {
  '28P01':
    'the password in GAB_RESEARCH_DATABASE_URL is wrong; put the value of ' +
    'GABRIEL_RESEARCH_PASSWORD of infra/.env',
  '3D000':
    'the database in GAB_RESEARCH_DATABASE_URL does not exist; name the database gabriel, as in ' +
    'research/.env.example',
  ECONNREFUSED: STOPPED,
  ETIMEDOUT: STOPPED,
  ENOTFOUND: 'the host in GAB_RESEARCH_DATABASE_URL does not exist; use 127.0.0.1',
};

const stop = (cause: unknown): never => {
  // A refusal is the sentence the operator needs. Any other fault can hold the URL, so only its
  // code goes out.
  if (cause instanceof StartRefusal) console.error(cause.message);
  else {
    const code =
      typeof cause === 'object' && cause !== null && 'code' in cause ? String(cause.code) : '';
    const reason = START_FAULTS[code];
    console.error(
      `the MCP server did not start${code === '' ? '' : ` (${code})`}${reason === undefined ? '' : `: ${reason}`}`,
    );
  }
  process.exit(1);
};

// The read tools need no object store, so a workspace with no store credential still starts, and
// only the tools that store refuse. The sentence of the store names no secret. The web needs no store.
// A browser saves a page into the inbox for the research AI. GAB_INBOX can name the download
// folder of the browser; with no value, the inbox is the folder inbox of the research workspace.
const GIVEN_INBOX = process.env['GAB_INBOX']?.trim() ?? '';
const INBOX = resolve(
  GIVEN_INBOX === ''
    ? fileURLToPath(new URL('../../../research/inbox', import.meta.url))
    : GIVEN_INBOX,
);

const reachOf = (): Reach => {
  const web = webOf(process.env);
  try {
    const store = openStore();
    return {
      store: { put: (object) => putObject(store, object) },
      web,
      inbox: INBOX,
      now: () => new Date(),
    };
  } catch (cause) {
    console.error(
      `the tools that store are off: ${cause instanceof Error ? cause.message : 'no object store'}`,
    );
    return { web, now: () => new Date() };
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
  await mkdir(INBOX, { recursive: true });
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  process.stdin.once('end', shutdown);
  await createServer(pool, reachOf()).connect(new StdioServerTransport());
  console.error('the MCP server runs as gabriel_research over stdio');
};

await start().catch(stop);
