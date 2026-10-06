// The archive tool against a stub web. An address with a secret in it must never leave the
// machine, a capture is allowed only for a page that is stored, and every address the tool builds
// has the constant archive host.

import { describe, expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { callTool, type Tool, type WebAnswer } from './tool.ts';
import {
  json,
  noSql,
  recordingSession,
  stubWeb,
  text,
  webReach,
  type Answerer,
  type StubWeb,
} from './web-stub.ts';

const archiveSnapshot = ((): Tool => {
  const found = CATALOGUE.find((tool) => tool.name === 'archive_snapshot');
  if (found === undefined) throw new Error('the catalogue holds no tool named archive_snapshot');
  return found;
})();

const URL_OFFLINE = 'https://example.org/press/release-2025-1476.html';
const SECRET = 'SECRET-TOKEN-4242';
const STORED = [{ one: 1 }];

const CDX_ROWS = [
  ['timestamp', 'mimetype', 'statuscode'],
  ['20250301120000', 'text/html', '200'],
  ['20250915093000', 'text/html', '200'],
];

const cdx =
  (rows: unknown): Answerer =>
  (asked) =>
    asked.url.pathname === '/cdx/search/cdx' ? json(rows) : new Error(`no route ${asked.url.href}`);

const saved =
  (answer: WebAnswer): Answerer =>
  (asked) =>
    asked.url.pathname.startsWith('/save/') ? answer : cdx(CDX_ROWS)(asked);

const refusalOf = async (
  web: StubWeb,
  input: unknown,
  session = noSql,
  now = () => new Date('2026-10-05T10:00:00Z'),
): Promise<string> => {
  const outcome = await callTool(archiveSnapshot, session, input, webReach(web, now));
  if (outcome.ok) throw new Error('the tool took the input, and it had to refuse it');
  return outcome.refusal;
};

describe('the lookup', () => {
  test('a lookup of an https address that is not stored passes, and it touches no table', async () => {
    const web = stubWeb(cdx(CDX_ROWS));
    const outcome = await callTool(archiveSnapshot, noSql, { url: URL_OFFLINE }, webReach(web));

    expect(outcome).toStrictEqual({
      ok: true,
      output: {
        captures: [
          {
            timestamp: '20250915093000',
            capturedAt: '2025-09-15T09:30:00.000Z',
            mime: 'text/html',
            address: `https://web.archive.org/web/20250915093000id_/${URL_OFFLINE}`,
          },
          {
            timestamp: '20250301120000',
            capturedAt: '2025-03-01T12:00:00.000Z',
            mime: 'text/html',
            address: `https://web.archive.org/web/20250301120000id_/${URL_OFFLINE}`,
          },
        ],
        newCapture: null,
        notice: null,
      },
    });
    expect(web.asked).toHaveLength(1);
    expect(web.asked[0]?.url.origin).toBe('https://web.archive.org');
    expect(web.asked[0]?.url.searchParams.get('url')).toBe(URL_OFFLINE);
  });

  test('an address with no capture gives an empty list and a notice', async () => {
    const web = stubWeb((asked) => ({ ...text('', 200), headers: { 'x-from': asked.url.host } }));
    const outcome = await callTool(archiveSnapshot, noSql, { url: URL_OFFLINE }, webReach(web));
    expect(outcome).toStrictEqual({
      ok: true,
      output: {
        captures: [],
        newCapture: null,
        notice: 'the archive holds no capture of this address',
      },
    });
  });

  test('the host of each address is the constant host, whatever the answer holds', async () => {
    const hostile = [
      ['timestamp', 'original', 'mimetype', 'statuscode'],
      ['20250915093000', 'https://evil.example/x', 'text/html', '200'],
      ['2025/../evil.example', URL_OFFLINE, 'text/html', '200'],
      ['20250915093000id_/https://evil.example', URL_OFFLINE, 'text/html', '200'],
    ];
    const web = stubWeb(cdx(hostile));
    const outcome = await callTool(archiveSnapshot, noSql, { url: URL_OFFLINE }, webReach(web));
    if (!outcome.ok) throw new Error(outcome.refusal);
    const { captures } = outcome.output as { captures: { address: string }[] };
    expect(captures).toHaveLength(1);
    for (const capture of captures) {
      expect(new URL(capture.address).host).toBe('web.archive.org');
      expect(capture.address).toBe(`https://web.archive.org/web/20250915093000id_/${URL_OFFLINE}`);
    }
  });

  test('a failed lookup is a refusal and never an empty list', async () => {
    expect(
      await refusalOf(
        stubWeb(() => text('down', 503)),
        { url: URL_OFFLINE },
      ),
    ).toMatch(/503/u);
    expect(
      await refusalOf(
        stubWeb(() => new Error('reset')),
        { url: URL_OFFLINE },
      ),
    ).toBeTruthy();
    expect(
      await refusalOf(
        stubWeb(() => text('<html>')),
        { url: URL_OFFLINE },
      ),
    ).toBeTruthy();
  });

  test('with no web in the reach, the tool refuses', async () => {
    const outcome = await callTool(archiveSnapshot, noSql, { url: URL_OFFLINE }, undefined);
    expect(outcome.ok).toBe(false);
  });
});

describe('an address that could leave a secret is refused before any request', () => {
  test.each([
    [`${URL_OFFLINE}?token=${SECRET}`, 'query string'],
    [`${URL_OFFLINE}?`, 'empty query string'],
    [`${URL_OFFLINE}#${SECRET}`, 'fragment'],
    [`https://user:${SECRET}@example.org/page`, 'user information'],
    ['http://example.org/page', 'plain http'],
    ['ftp://example.org/page', 'ftp'],
    ['example.org/page', 'no scheme'],
  ])('%s (%s) is refused for the lookup and for the capture', async (url) => {
    for (const capture of [false, true]) {
      const web = stubWeb(cdx(CDX_ROWS));
      const session = recordingSession(STORED);
      const refusal = await refusalOf(web, { url, capture }, session);
      expect(refusal).not.toContain(SECRET);
      expect(web.asked).toStrictEqual([]);
      expect(session.statements).toStrictEqual([]);
    }
  });
});

describe('a capture', () => {
  const stored = (): ReturnType<typeof recordingSession> => recordingSession(STORED);

  test('an https address with no query string that is not stored is refused, with no request', async () => {
    const web = stubWeb(cdx(CDX_ROWS));
    const session = recordingSession([]);
    const refusal = await refusalOf(web, { url: URL_OFFLINE, capture: true }, session);

    expect(refusal).toMatch(/fetch_document/u);
    expect(session.statements).toHaveLength(1);
    expect(web.asked).toStrictEqual([]);
  });

  test('the same address passes as a lookup', async () => {
    const web = stubWeb(cdx(CDX_ROWS));
    const outcome = await callTool(
      archiveSnapshot,
      noSql,
      { url: URL_OFFLINE, capture: false },
      webReach(web),
    );
    expect(outcome.ok).toBe(true);
  });

  test('a stored page is captured, and the new address has the constant host', async () => {
    const web = stubWeb(
      saved(
        text('', 302, {
          location: '/web/20261005100001/https://example.org/press/release-2025-1476.html',
        }),
      ),
    );
    const session = stored();
    const outcome = await callTool(
      archiveSnapshot,
      session,
      { url: URL_OFFLINE, capture: true },
      webReach(web),
    );

    if (!outcome.ok) throw new Error(outcome.refusal);
    const output = outcome.output as { newCapture: { address: string; timestamp: string } };
    expect(output.newCapture).toStrictEqual({
      timestamp: '20261005100001',
      address: `https://web.archive.org/web/20261005100001id_/${URL_OFFLINE}`,
    });
    expect(web.asked.map((asked) => asked.url.origin)).toStrictEqual([
      'https://web.archive.org',
      'https://web.archive.org',
    ]);
    expect(web.asked[1]?.url.pathname.startsWith('/save/')).toBe(true);
    expect(session.statements).toHaveLength(1);
  });

  test('a content-location header names the new capture too', async () => {
    const web = stubWeb(
      saved(text('', 200, { 'content-location': '/web/20261005100002/https://example.org/x' })),
    );
    const outcome = await callTool(
      archiveSnapshot,
      stored(),
      { url: URL_OFFLINE, capture: true },
      webReach(web),
    );
    if (!outcome.ok) throw new Error(outcome.refusal);
    expect((outcome.output as { newCapture: { timestamp: string } }).newCapture.timestamp).toBe(
      '20261005100002',
    );
  });

  test('a hostile location is not followed and gives no address', async () => {
    const web = stubWeb(saved(text('', 302, { location: 'https://evil.example/web/2026/x' })));
    const refusal = await refusalOf(web, { url: URL_OFFLINE, capture: true }, stored());
    expect(refusal).toMatch(/no capture address/u);
    expect(web.asked.every((asked) => asked.url.host === 'web.archive.org')).toBe(true);
  });

  test('a second capture inside the gap is refused, and one after the gap passes', async () => {
    const web = stubWeb(
      saved(text('', 302, { location: '/web/20261005100001/https://example.org/x' })),
    );
    let at = new Date('2026-10-05T10:00:00Z');
    const reach = webReach(web, () => at);
    const first = await callTool(
      archiveSnapshot,
      stored(),
      { url: URL_OFFLINE, capture: true },
      reach,
    );
    expect(first.ok).toBe(true);

    at = new Date('2026-10-05T10:00:05Z');
    const second = await callTool(
      archiveSnapshot,
      stored(),
      { url: URL_OFFLINE, capture: true },
      reach,
    );
    expect(second.ok).toBe(false);
    const saves = web.asked.filter((asked) => asked.url.pathname.startsWith('/save/'));
    expect(saves).toHaveLength(1);

    at = new Date('2026-10-05T10:01:00Z');
    const third = await callTool(
      archiveSnapshot,
      stored(),
      { url: URL_OFFLINE, capture: true },
      reach,
    );
    expect(third.ok).toBe(true);
  });

  test('the gap belongs to one web, so a second web captures at once', async () => {
    const answer = saved(text('', 302, { location: '/web/20261005100001/https://example.org/x' }));
    const now = () => new Date('2026-10-05T10:00:00Z');
    const one = stubWeb(answer);
    const two = stubWeb(answer);
    const input = { url: URL_OFFLINE, capture: true };
    expect((await callTool(archiveSnapshot, stored(), input, webReach(one, now))).ok).toBe(true);
    expect((await callTool(archiveSnapshot, stored(), input, webReach(one, now))).ok).toBe(false);
    expect((await callTool(archiveSnapshot, stored(), input, webReach(two, now))).ok).toBe(true);
  });

  test('a rate limit of the archive is a refusal that says so', async () => {
    const web = stubWeb(saved(text('slow down', 429)));
    expect(await refusalOf(web, { url: URL_OFFLINE, capture: true }, stored())).toMatch(
      /rate limit/u,
    );
  });

  test('a failed capture is a refusal and never an empty answer', async () => {
    const web = stubWeb(saved(text('error', 500)));
    expect(await refusalOf(web, { url: URL_OFFLINE, capture: true }, stored())).toMatch(/500/u);
  });
});

describe('the tool writes nothing', () => {
  test('every statement it sends is a select, and a lookup sends none', async () => {
    const session = recordingSession(STORED);
    const web = stubWeb(
      saved(text('', 302, { location: '/web/20261005100001/https://example.org/x' })),
    );
    await callTool(archiveSnapshot, session, { url: URL_OFFLINE, capture: true }, webReach(web));
    await callTool(archiveSnapshot, session, { url: URL_OFFLINE }, webReach(web));

    expect(session.statements.length).toBeGreaterThan(0);
    for (const statement of session.statements) {
      expect(statement.trimStart()).toMatch(/^SELECT\b/iu);
      expect(statement).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/iu);
    }
  });
});
