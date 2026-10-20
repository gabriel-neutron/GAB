// The UN Comtrade tool, offline: a web that answers from recorded answers, a store in memory and a
// database that is a map of hashes. No test reaches the network and no test spends a call.

import { expect, test } from 'vitest';

import { CATALOGUE } from './catalogue.ts';
import { resetComtradeClock } from './comtrade-data.ts';
import { memoryStore } from './fetch-fixture.ts';
import { callTool, type ToolOutcome, type WebAnswer } from './tool.ts';
import { hashDatabase, json, stubWeb, text, type Asked } from './web-stub.ts';

const KEY = 'comtrade-secret-key-1';
const tool = CATALOGUE.find((entry) => entry.name === 'comtrade_data');
if (tool === undefined) throw new Error('the catalogue holds no comtrade_data');

// Handwritten answer in the assumed shape of the Comtrade API, version 1.
const ANSWER = {
  elapsedTime: '0.2 secs',
  count: 1,
  data: [{ reporterCode: 643, partnerCode: 156, period: '2023', flowCode: 'X', cmdCode: '2709' }],
  error: '',
};

const INPUT = { reporter: '643', period: '2023', flow: 'X', hsCode: '2709', partner: '156' };

const setup = (
  options: { key?: string; answer?: (asked: Asked) => WebAnswer | Error; sleeps?: number[] } = {},
) => {
  resetComtradeClock();
  const web = stubWeb(options.answer ?? (() => json(ANSWER)), {
    ...(options.key === '' ? {} : { comtradeKey: options.key ?? KEY }),
  });
  const store = memoryStore();
  const session = hashDatabase();
  const reach = {
    store,
    web,
    now: () => new Date('2026-10-05T10:00:00Z'),
    sleep: (ms: number) => {
      options.sleeps?.push(ms);
      return Promise.resolve();
    },
  };
  return { web, store, session, reach };
};

const refusalOf = (outcome: ToolOutcome): string => (outcome.ok ? '' : outcome.refusal);

test('one reporter, one period and one HS code are read and stored as a document', async () => {
  const { web, store, session, reach } = setup();
  const outcome = await callTool(tool, session, INPUT, reach);
  expect(outcome).toMatchObject({
    ok: true,
    output: { status: 'stored', rows: 1, reporter: '643', period: '2023', flow: 'X' },
  });
  expect(web.asked).toHaveLength(1);
  const asked = web.asked[0];
  expect(`${asked?.url.origin ?? ''}${asked?.url.pathname ?? ''}`).toBe(
    'https://comtradeapi.un.org/data/v1/get/C/A/HS',
  );
  expect(Object.fromEntries(asked?.url.searchParams ?? [])).toEqual({
    reporterCode: '643',
    period: '2023',
    flowCode: 'X',
    cmdCode: '2709',
    partnerCode: '156',
    maxRecords: '100000',
  });
  expect(store.puts).toHaveLength(1);
  // The provider is the last value of the store statement.
  expect(session.stored[0]?.[9]).toBe('un_comtrade');
});

test('a month is read with the monthly frequency', async () => {
  const { web, session, reach } = setup();
  await callTool(tool, session, { ...INPUT, period: '202306' }, reach);
  expect(web.asked[0]?.url.pathname).toBe('/data/v1/get/C/M/HS');
});

test('the key is in the header only, and not in the stored address, body, output or error', async () => {
  const { web, store, session, reach } = setup();
  const first = await callTool(tool, session, INPUT, reach);
  expect(first).toMatchObject({ ok: true });
  expect(web.asked[0]?.headers['Ocp-Apim-Subscription-Key']).toBe(KEY);
  expect(web.asked[0]?.url.href).not.toContain(KEY);
  expect(JSON.stringify(session.stored)).not.toContain(KEY);
  expect(JSON.stringify(first)).not.toContain(KEY);
  expect(new TextDecoder().decode(store.puts[0]?.bytes)).not.toContain(KEY);
  expect(session.stored[0]?.[2]).toBe(
    'https://comtradeapi.un.org/data/v1/get/C/A/HS?reporterCode=643&period=2023&flowCode=X&cmdCode=2709&partnerCode=156',
  );

  const second = await callTool(tool, session, INPUT, reach);
  expect(second).toMatchObject({ ok: true, output: { status: 'known' } });
  expect(store.puts).toHaveLength(1);

  const fault = setup({ answer: () => new Error(`connect failed with ${KEY}`) });
  const failed = await callTool(tool, fault.session, INPUT, fault.reach);
  expect(refusalOf(failed)).toBe('UN Comtrade: no whole answer came');
});

test('a body that holds the key is refused and not stored', async () => {
  const { store, session, reach } = setup({
    answer: () => json({ ...ANSWER, error: `bad ${KEY}` }),
  });
  const outcome = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(outcome)).not.toContain(KEY);
  expect(refusalOf(outcome)).not.toBe('');
  expect(store.puts).toHaveLength(0);
});

test('with no key set the tool refuses and names the setting', async () => {
  const { web, session, reach } = setup({ key: '' });
  const outcome = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(outcome)).toContain('COMTRADE_API_KEY');
  expect(web.asked).toHaveLength(0);
});

test('a refusal of the server gives a clear message and stores nothing', async () => {
  const cases: [WebAnswer, string][] = [
    [text('Out of call volume quota. Quota will be replenished in 02:00:00', 429), 'daily quota'],
    [text('Rate limit is exceeded. Try again in 1 seconds.', 429), 'one call a second'],
    [text('bad', 400), 'refused the request'],
    [text('denied', 401), 'refused the key'],
    [text('error', 500), 'answered 500'],
  ];
  for (const [answer, words] of cases) {
    const { store, session, reach } = setup({ answer: () => answer });
    const outcome = await callTool(tool, session, INPUT, reach);
    expect(refusalOf(outcome)).toContain(words);
    expect(refusalOf(outcome)).not.toContain('Quota will be');
    expect(store.puts).toHaveLength(0);
  }
});

test('an answer that fills the row cap is refused, because it may be cut', async () => {
  const rows = Array.from({ length: 100_000 }, () => ({ cmdCode: '2709' }));
  const { store, session, reach } = setup({ answer: () => json({ ...ANSWER, data: rows }) });
  const outcome = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(outcome)).toContain('100000');
  expect(store.puts).toHaveLength(0);
});

test('an answer of another shape is refused', async () => {
  const { session, reach } = setup({ answer: () => json({ hello: 'world' }) });
  const outcome = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(outcome)).toContain('UN Comtrade');
});

test('the first call does not wait and the second waits about one second', async () => {
  const sleeps: number[] = [];
  const { session, reach } = setup({ sleeps });
  await callTool(tool, session, INPUT, reach);
  expect(sleeps).toEqual([]);
  await callTool(tool, session, { ...INPUT, hsCode: '2710' }, reach);
  expect(sleeps).toEqual([1100]);
});

test('calls that run together take slots one second apart', async () => {
  const sleeps: number[] = [];
  const { session, reach } = setup({ sleeps });
  await Promise.all(
    ['2709', '2710', '2711'].map((hsCode) => callTool(tool, session, { ...INPUT, hsCode }, reach)),
  );
  expect([...sleeps].sort((a, b) => a - b)).toEqual([1100, 2200]);
});

test('a 429 names both causes', async () => {
  const { session, reach } = setup({ answer: () => text('something new', 429) });
  const outcome = await callTool(tool, session, INPUT, reach);
  expect(refusalOf(outcome)).toContain('daily quota');
  expect(refusalOf(outcome)).toContain('one call a second');
});

test('a code or a period of a wrong shape is refused before any call', async () => {
  const { web, session, reach } = setup();
  const bad = await callTool(tool, session, { ...INPUT, period: '23' }, reach);
  expect(bad.ok).toBe(false);
  expect(web.asked).toHaveLength(0);
});
