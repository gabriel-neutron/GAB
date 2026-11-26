import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { refusedAddress } from '@gab/tools/fetch-guard';
import { FIXTURE_HOST, fixtureLookup, startFixture, type Fixture } from '@gab/tools/fetch-fixture';
import type { Reach } from '@gab/tools/tool';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { excerptAtSource, sha256Of, type Claim, type SourceReader } from './node-audit-checks.ts';
import { localCheckIds, localCheckLines, readSource, sourceReader } from './node-audit-source.ts';

const PAGE = `<html><head><title>Notice</title></head><body><p>${'The register lists the vessel OCEAN STAR, IMO 9435337, under the flag of Gabon. '.repeat(30)}</p></body></html>`;
const html = { 'content-type': 'text/html; charset=utf-8' };

let fixture: Fixture;
const at = (path: string) => `http://${FIXTURE_HOST}:${String(fixture.port)}${path}`;
// The fixture listens on the loopback address, and the test opens no other address.
const reach: Reach = {
  now: () => new Date(),
  lookup: fixtureLookup,
  refuses: (address) => address !== '127.0.0.1' && refusedAddress(address),
  fetchTimeoutMs: 2000,
};

beforeAll(async () => {
  fixture = await startFixture({
    '/page': { headers: html, body: PAGE },
    '/forbidden': { status: 403, headers: html, body: '<p>Forbidden</p>' },
    '/limit': { status: 429, headers: html, body: '<p>Too many requests</p>' },
    '/down': { status: 502, headers: html, body: '<p>Bad gateway</p>' },
    '/challenge': {
      headers: html,
      body: '<html><body>Just a moment... Checking your browser</body></html>',
    },
    '/blank': { headers: { 'content-type': 'text/plain' }, body: '   ' },
    '/binary': { headers: { 'content-type': 'application/x-unknown' }, body: 'abc' },
  });
});
afterAll(async () => {
  await fixture.close();
});

describe('the live read of a cited document', () => {
  it('gives the text of a page', async () => {
    const read = await readSource(at('/page'), reach);
    expect(read.kind).toBe('text');
    if (read.kind === 'text') expect(read.text).toContain('IMO 9435337');
  });

  it('names the cause of each read that gives no text', async () => {
    const reasons = await Promise.all(
      ['/forbidden', '/limit', '/challenge', '/down', '/gone', '/blank', '/binary'].map(
        async (path) => readSource(at(path), reach),
      ),
    );
    expect(reasons).toEqual(
      ['blocked', 'blocked', 'blocked', 'unreachable', 'unreachable', 'not_text', 'not_text'].map(
        (reason) => ({ kind: 'cannot_check', reason }),
      ),
    );
  });

  it('gives no_address for a blank address or an address that is no web address', async () => {
    expect(await readSource('', reach)).toEqual({ kind: 'cannot_check', reason: 'no_address' });
    expect(await readSource('file:///etc/passwd', reach)).toEqual({
      kind: 'cannot_check',
      reason: 'no_address',
    });
  });

  it('gives unreachable when the name does not resolve', async () => {
    expect(await readSource('http://absent.test/page', reach)).toEqual({
      kind: 'cannot_check',
      reason: 'unreachable',
    });
  });

  it('gives blocked for a host of the leak deny list, with no connection', async () => {
    const before = fixture.requests.length;
    expect(await readSource('https://wikileaks.org/page', reach)).toEqual({
      kind: 'cannot_check',
      reason: 'blocked',
    });
    expect(fixture.requests.length).toBe(before);
  });
});

describe('the cache and the local-check file', () => {
  it('reads each document once, also in a resumed run, and lists each one it could not read', async () => {
    const out = mkdtempSync(join(tmpdir(), 'node-audit-source-'));
    const before = fixture.requests.length;
    const read = sourceReader(out, reach, 0);
    await read('doc_ok', at('/page'));
    await read('doc_ok', at('/page'));
    await read('doc/403', at('/forbidden'));
    await read('doc_none', '');
    // A resumed run reads the cache of the out folder.
    await sourceReader(out, reach, 0)('doc_ok', at('/page'));
    expect(fixture.requests.length - before).toBe(2);
    const lines = localCheckLines(out);
    expect(lines).toEqual(['doc/403 blocked', 'doc_none no_address']);
    expect([...localCheckIds(`${lines.join('\n')}\n\n`)]).toEqual(['doc/403', 'doc_none']);
  });

  it('reads a block again in a resumed run, and reads again a cut file or a new address', async () => {
    const out = mkdtempSync(join(tmpdir(), 'node-audit-source-'));
    await sourceReader(out, reach, 0)('doc_ok', at('/page'));
    await sourceReader(out, reach, 0)('doc/403', at('/forbidden'));
    const before = fixture.requests.length;
    const resumed = sourceReader(out, reach, 0);
    await resumed('doc/403', at('/forbidden'));
    // Once in a run only.
    await resumed('doc/403', at('/forbidden'));
    expect(fixture.requests.length - before).toBe(1);
    const file = join(out, 'sources', `${sha256Of(new TextEncoder().encode('doc_ok'))}.json`);
    writeFileSync(file, '{"id":"doc_ok","addr');
    expect(localCheckLines(out)).toEqual(['doc/403 blocked']);
    expect((await sourceReader(out, reach, 0)('doc_ok', at('/page'))).kind).toBe('text');
    expect((await sourceReader(out, reach, 0)('doc_ok', at('/down'))).kind).toBe('cannot_check');
    expect(fixture.requests.length - before).toBe(3);
  });
});

const claim = (citations: Record<string, string>[]): Claim => ({
  id: 'c',
  kind: 'attribute',
  subject: 'v1',
  attribute: 'imo',
  value: '9435337',
  relationType: '',
  object: '',
  objectLabel: '',
  citations,
});

const fake =
  (texts: Record<string, string>): SourceReader =>
  (id) => {
    const got = texts[id];
    return Promise.resolve(
      got === 'blocked' || got === 'unreachable'
        ? { kind: 'cannot_check', reason: got }
        : { kind: 'text', text: got ?? '' },
    );
  };

describe('the check excerpt_at_source', () => {
  const row = (id: string, excerpt = 'IMO 9435337') => ({
    document_id: id,
    document_address: `https://example.org/${id}`,
    excerpt,
  });
  const sources = fake({
    a: 'The vessel, IMO\n9435337, is a tanker.',
    b: 'Other text.',
    x: 'blocked',
    y: 'unreachable',
  });

  it('passes when one excerpt is in its document, with the matcher of the audit', async () => {
    expect(await excerptAtSource(claim([row('x'), row('a')]), 'release', sources)).toMatchObject({
      verdict: 'pass',
    });
  });

  it('fails when each document was read and holds no excerpt', async () => {
    expect(await excerptAtSource(claim([row('b')]), 'release', sources)).toEqual({
      check: 'excerpt_at_source',
      verdict: 'fail',
      reason: 'excerpt_not_at_source',
    });
  });

  it('gives cannot_check with the cause when a document could not be read', async () => {
    expect(
      await excerptAtSource(claim([row('b'), row('y'), row('x')]), 'release', sources),
    ).toMatchObject({ verdict: 'cannot_check', reason: 'blocked: y x' });
  });

  it('does not run in record mode, and needs a reader in release mode', async () => {
    expect((await excerptAtSource(claim([row('a')]), 'record', sources)).verdict).toBe(
      'not_applicable',
    );
    expect(await excerptAtSource(claim([row('a')]), 'release', null)).toMatchObject({
      verdict: 'cannot_check',
      reason: 'needs_source',
    });
    expect((await excerptAtSource(claim([row('a', ' ')]), 'release', sources)).verdict).toBe(
      'not_applicable',
    );
  });
});
