import { z } from 'zod';

import { defineTool, ToolRefusal, type Web } from './tool.ts';
import { anyAnswerOf, answerOf, UpstreamFault, webFromReach } from './web-access.ts';

// External constraint: the archive has one host, and each address this tool returns is built from
// it. The archive names a capture by a timestamp of fourteen digits, so that is the one part of
// its answer that enters an address, and only after it passes the pattern below.
const ARCHIVE = 'https://web.archive.org';
const STAMP = /^\d{14}$/u;
const SAVED = /^\/web\/(\d{14})(?:[a-z]{2}_)?\//u;

const MAX_CAPTURES = 10;

// Assumptions of the first build. A capture is slow, and a burst of captures is how a client gets
// blocked, so the tool allows one capture each fifteen seconds for each web it was given.
const CAPTURE_TIMEOUT_MS = 60_000;
const CAPTURE_GAP_MS = 15_000;
const lastCapture = new WeakMap<Web, number>();

const STORED = 'SELECT 1 AS stored FROM public.documents WHERE uri = ANY($1::text[]) LIMIT 1';

const captureShape = z.strictObject({
  timestamp: z.string(),
  capturedAt: z.string(),
  mime: z.string().nullable(),
  address: z.string(),
});

const outputShape = z.strictObject({
  captures: z.array(captureShape),
  newCapture: z.strictObject({ timestamp: z.string(), address: z.string() }).nullable(),
  notice: z.string().nullable(),
});

const cdxRow = z
  .tuple([z.string(), z.string().nullable(), z.string().nullable()])
  .rest(z.unknown());

// The raw copy of a capture, the form that fetch_document can read and store. The host is the
// constant, the stamp passed its pattern, and the original is the address the caller gave.
const rawAddress = (stamp: string, original: string): string =>
  `${ARCHIVE}/web/${stamp}id_/${original}`;

const isoOf = (stamp: string): string =>
  new Date(
    `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}` +
      `T${stamp.slice(8, 10)}:${stamp.slice(10, 12)}:${stamp.slice(12, 14)}Z`,
  ).toISOString();

// Only an https address with no query string, no fragment and no user information leaves this
// machine. A secret in an address would otherwise go to the archive, and be public there.
const checked = (raw: string): { readonly given: string; readonly href: string } => {
  const given = raw.trim();
  let url: URL;
  try {
    url = new URL(given);
  } catch {
    throw new ToolRefusal('the address is not an address, and nothing was asked of the archive');
  }
  if (url.protocol !== 'https:')
    throw new ToolRefusal('only an https address goes to the archive, and nothing was asked');
  if (given.includes('?') || given.includes('#') || url.username !== '' || url.password !== '')
    throw new ToolRefusal(
      'an address with a query string, a fragment or user information does not go to the ' +
        'archive, because it may hold a secret',
    );
  return { given, href: url.href };
};

const lookup = async (web: Web, original: string) => {
  const url = new URL(`${ARCHIVE}/cdx/search/cdx`);
  url.searchParams.set('url', original);
  url.searchParams.set('output', 'json');
  url.searchParams.set('fl', 'timestamp,mimetype,statuscode');
  url.searchParams.set('filter', 'statuscode:200');
  url.searchParams.set('limit', String(-MAX_CAPTURES));
  const { body } = await answerOf(web, url.href);
  // An address with no capture gets an empty body and not an empty list.
  if (body.trim() === '') return [];
  let rows: unknown;
  try {
    rows = JSON.parse(body);
  } catch {
    throw new UpstreamFault('the answer is not JSON');
  }
  if (!Array.isArray(rows)) throw new UpstreamFault('the answer is not a list');
  const found: z.output<typeof captureShape>[] = [];
  for (const held of rows as unknown[]) {
    const row = cdxRow.safeParse(held);
    const stamp = row.success ? row.data[0] : '';
    if (!row.success || !STAMP.test(stamp)) continue;
    found.push({
      timestamp: stamp,
      capturedAt: isoOf(stamp),
      mime: row.data[1],
      address: rawAddress(stamp, original),
    });
  }
  // The newest capture comes first.
  return found.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
};

// A redirect is how the archive names the new capture. It is read and never followed.
const save = async (web: Web, original: string): Promise<string> => {
  let answer;
  try {
    answer = await anyAnswerOf(web, `${ARCHIVE}/save/${original}`, {
      timeoutMs: CAPTURE_TIMEOUT_MS,
    });
  } catch {
    throw new ToolRefusal('the capture failed: no whole answer came');
  }
  if (answer.status === 429)
    throw new ToolRefusal('the rate limit of the archive is reached: try again later');
  if (answer.status < 200 || answer.status >= 400)
    throw new ToolRefusal(`the capture failed: the server answered ${answer.status}`);
  for (const named of [answer.headers['content-location'], answer.headers['location']]) {
    const stamp = named === undefined ? undefined : SAVED.exec(named)?.[1];
    if (stamp !== undefined) return stamp;
  }
  throw new ToolRefusal('the archive gave no capture address for this page');
};

export const archiveSnapshot = defineTool({
  name: 'archive_snapshot',
  description:
    'Lists the Wayback Machine captures of one https address that has no query string, newest ' +
    'first. Each capture comes with its raw address, which fetch_document can store. With ' +
    'capture true, it asks for a new capture, and only for an address that fetch_document ' +
    'already stored; one capture is allowed each fifteen seconds. Nothing is stored here.',
  input: z.strictObject({
    url: z.string().trim().min(1).max(2048),
    capture: z.boolean().default(false),
  }),
  output: outputShape,
  async run(session, input, reach) {
    const web = webFromReach(reach);
    const { given, href } = checked(input.url);

    // The stored check applies to a capture alone: a lookup must work for a page that is not
    // stored, because that is the page that went offline before anyone fetched it.
    if (input.capture) {
      const { rows } = await session.query(STORED, [[given, href]]);
      if (rows.length === 0)
        throw new ToolRefusal(
          'a capture is allowed only for an address that fetch_document already stored: fetch ' +
            'the page first',
        );
      const now = reach?.now().getTime() ?? 0;
      const last = lastCapture.get(web);
      if (last !== undefined && now - last < CAPTURE_GAP_MS)
        throw new ToolRefusal(
          `one capture is allowed each ${CAPTURE_GAP_MS / 1000} seconds: wait and try again`,
        );
    }

    let captures;
    try {
      captures = await lookup(web, given);
    } catch (fault) {
      if (fault instanceof UpstreamFault)
        throw new ToolRefusal(`the archive lookup failed: ${fault.message}`);
      throw fault;
    }

    let newCapture: { timestamp: string; address: string } | null = null;
    if (input.capture) {
      lastCapture.set(web, reach?.now().getTime() ?? 0);
      const timestamp = await save(web, given);
      newCapture = { timestamp, address: rawAddress(timestamp, given) };
    }

    return {
      captures,
      newCapture,
      notice: captures.length === 0 ? 'the archive holds no capture of this address' : null,
    };
  },
});
