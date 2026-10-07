import { openReadStore, openStore, putObject, readObject } from '@gab/store';
import { serve } from '@hono/node-server';

import { openPool } from './pool.ts';
import { writeRoutes } from './routes.ts';

// The adapter binds `::` when no hostname is given, and the writer answers on the loopback
// address alone. The browser reaches it through the proxy of the development server.
const HOSTNAME = '127.0.0.1';
const PORT = 5177;

const pool = openPool();
const store = openStore();
const reader = openReadStore();
const app = writeRoutes(
  pool,
  { put: (object) => putObject(store, object) },
  { read: (key) => readObject(reader, key) },
);

serve({ fetch: app.fetch, hostname: HOSTNAME, port: PORT });
console.log(`The writer answers on http://${HOSTNAME}:${PORT}/write`);
