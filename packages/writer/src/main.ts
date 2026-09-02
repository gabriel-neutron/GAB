import { serve } from '@hono/node-server';

import { openPool } from './pool.ts';
import { writeRoutes } from './routes.ts';
import { openVocabulary } from './vocabulary.ts';

// The adapter binds `::` when no hostname is given, and the writer answers on the loopback
// address alone. The browser reaches it through the proxy of the development server.
const HOSTNAME = '127.0.0.1';
const PORT = 5177;

const pool = openPool();
const app = writeRoutes(pool, await openVocabulary(pool));

serve({ fetch: app.fetch, hostname: HOSTNAME, port: PORT });
console.log(`The writer answers on http://${HOSTNAME}:${PORT}/write`);
