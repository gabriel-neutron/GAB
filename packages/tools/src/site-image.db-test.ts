// The image of a site box, against the disposable database as gabriel_research and a local WMS.
// Each call runs inside a transaction that rolls back.

import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { join } from 'node:path';

import { afterAll, beforeAll, expect, test } from 'vitest';
import { z } from 'zod';

import { rolledBack, type Ask } from '../../../tools/probe.ts';
import { FIXTURE_HOST, fixtureReach, memoryStore } from './fetch-fixture.ts';
import { imageAddress, imageSize, SITE_IMAGE_CREDIT, siteImageAt } from './site-image.ts';
import { callTool, type Session } from './tool.ts';

// Each run gets other bytes, so no row of an earlier run makes the image known.
const RUN = Buffer.from(`${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`);

let jpeg: Buffer;
let server: Server;
let wms: string;
const asked: string[] = [];

beforeAll(async () => {
  jpeg = Buffer.concat([
    await readFile(join(import.meta.dirname, '../../text/fixtures/unit-tree.jpg')),
    RUN,
  ]);
  server = createServer((request, response) => {
    asked.push(request.url ?? '');
    const query = new URL(request.url ?? '/', 'http://local').searchParams;
    if (query.get('layers') !== 's2cloudless') {
      response.writeHead(200, { 'content-type': 'application/vnd.ogc.se_xml' });
      response.end('<ServiceExceptionReport>no such layer</ServiceExceptionReport>');
      return;
    }
    if (query.get('bbox')?.startsWith('1.000000') === true) {
      response.writeHead(200, { 'content-type': 'application/vnd.ogc.se_xml' });
      response.end('<ServiceExceptionReport>error</ServiceExceptionReport>');
      return;
    }
    response.writeHead(200, { 'content-type': 'image/jpeg' }).end(jpeg);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  wms = `http://${FIXTURE_HOST}:${String((server.address() as AddressInfo).port)}/wms`;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const sessionOf = (ask: Ask): Session => ({
  query: async (text, values) => ({ rows: await ask(text, values) }),
});

// The box of the Kirishi refinery.
const KIRISHI = { south: 59.42, west: 32.0, north: 59.46, east: 32.08, site: 'KINEF, Kirishi' };

test('the size of the image is about 10 m for each pixel, and at most 2048 pixels on a side', () => {
  expect(imageSize(KIRISHI)).toStrictEqual({ width: 453, height: 445 });
  expect(imageSize({ south: 0, west: 0, north: 0.25, east: 0.25 })).toStrictEqual({
    width: 2048,
    height: 2048,
  });
  expect(imageAddress('https://wms.test/wms', KIRISHI)).toContain(
    'layers=s2cloudless&styles=&srs=EPSG%3A4326&bbox=32.000000%2C59.420000%2C32.080000%2C59.460000',
  );
});

const documentRow = z.object({
  kind: z.string(),
  mime: z.string(),
  uri: z.string(),
  provider_id: z.string(),
  licence: z.string(),
  text: z.string(),
});

test('the image of a box is stored once, with its provider, its licence and a text that states the box', async () => {
  const store = memoryStore();
  const tool = siteImageAt(wms);
  await rolledBack('research', async (ask) => {
    const first = await callTool(tool, sessionOf(ask), KIRISHI, fixtureReach(store));
    if (!first.ok) throw new Error(first.refusal);
    const got = z
      .object({ document: z.string(), status: z.string(), url: z.string(), credit: z.string() })
      .parse(first.output);
    expect(got.status).toBe('stored');
    expect(got.url).toBe(imageAddress(wms, KIRISHI));
    expect(got.credit).toBe(SITE_IMAGE_CREDIT);

    const [row] = z.array(documentRow).parse(
      await ask(
        `SELECT d.kind, d.mime, d.uri, d.provider_id, p.licence, t.text
           FROM public.documents d
           JOIN public.document_provider p ON p.id = d.provider_id
           JOIN public.document_text t ON t.document_id = d.id
          WHERE d.id = $1`,
        [got.document],
      ),
    );
    expect(row).toMatchObject({
      kind: 'api',
      mime: 'image/jpeg',
      uri: got.url,
      provider_id: 'eox_s2cloudless_2016',
      licence: 'cc-by-4.0',
    });
    expect(row?.text).toContain('south 59.420000, west 32.000000, north 59.460000, east 32.080000');
    expect(row?.text).toContain('as it was in 2016');
    expect(row?.text).toContain(SITE_IMAGE_CREDIT);

    const again = await callTool(tool, sessionOf(ask), KIRISHI, fixtureReach(store));
    expect(again).toMatchObject({ ok: true, output: { status: 'known', document: got.document } });
  });
  expect(store.puts).toHaveLength(1);
});

test.each([
  ['a box with north under south', { ...KIRISHI, north: 59.4 }, 'north is larger'],
  ['a box larger than the limit', { ...KIRISHI, east: 32.5 }, 'at most'],
  ['a box too small to show a site', { ...KIRISHI, east: 32.001 }, 'at least'],
])('%s is refused before any request', async (_name, input, reason) => {
  const before = asked.length;
  const outcome = await callTool(
    siteImageAt(wms),
    sessionOf(() => Promise.resolve([])),
    input,
    {
      ...fixtureReach(memoryStore()),
    },
  );
  expect(outcome.ok ? '' : outcome.refusal).toContain(reason);
  expect(asked).toHaveLength(before);
});

test('an error of the service with a success status stores nothing', async () => {
  const store = memoryStore();
  await rolledBack('research', async (ask) => {
    const outcome = await callTool(
      siteImageAt(wms),
      sessionOf(ask),
      { south: 1, west: 1, north: 1.01, east: 1.01, site: 'test' },
      fixtureReach(store),
    );
    expect(outcome.ok ? '' : outcome.refusal).toContain('no JPEG image');
  });
  expect(store.puts).toStrictEqual([]);
});
