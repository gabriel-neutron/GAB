// The tool egrul_extract, offline: a web that answers from a table, a store in memory, and an extract
// written by hand in the layout of the register. Each name and number below is invented. No test
// reaches the network.

import { beforeEach, expect, test } from 'vitest';

import { egrulExtractWith, resetEgrulState } from './egrul-extract.ts';
import { egrulExcerptRefusal, extractSubject, isEgrulAddress, ownerSection } from './egrul-text.ts';
import { memoryStore } from './fetch-fixture.ts';
import { storeAnswer } from './store-answer.ts';
import {
  callTool,
  type ToolOutcome,
  type WebAnswer,
  type WebBytes,
  type WebRequest,
} from './tool.ts';
import { bytes, hashDatabase, json, stubWeb, type Asked, type AskedPost } from './web-stub.ts';

const TAX = '7700000011';

const PAGE_1 = `ВЫПИСКА
из Единого государственного реестра юридических лиц
Наименование
1 Полное наименование на русском языке ОБЩЕСТВО С ОГРАНИЧЕННОЙ
ОТВЕТСТВЕННОСТЬЮ "ПРИМЕР"
2 ГРН и дата внесения в ЕГРЮЛ записи,
содержащей указанные сведения 1000000000001
18.06.2008
8 ОГРН 1000000000001
Сведения о лице, имеющем право без доверенности действовать от имени юридического
лица
18 ГРН и дата внесения в ЕГРЮЛ сведений о
данном лице 1000000000001
18.06.2008
19 Фамилия
Имя
Отчество
КРАСНОВ
ПЁТР
СИДОРОВИЧ
20 ИНН 770000000012
22 Должность ДИРЕКТОР
Сведения об участниках / учредителях юридического лица
1
20 ГРН и дата внесения в ЕГРЮЛ сведений о
данном лице 9000000000001
26.10.2017
21 ОГРН 5000000000001
22 ИНН 7700000022
23 Полное наименование ОБЩЕСТВО С ОГРАНИЧЕННОЙ
ОТВЕТСТВЕННОСТЬЮ "ВЛАДЕЛЕЦ"
24 ГРН и дата внесения в ЕГРЮЛ записи,
содержащей указанные сведения 2000000000001
22.04.2025
25 Номинальная стоимость доли (в рублях) 8329285678.6321
26 Размер доли (в процентах) 49
Страница 1 из
Выписка из ЕГРЮЛ
31.10.2026 01:11 ОГРН 10000000000011`;

const PAGE_2 = `2
36 ГРН и дата внесения в ЕГРЮЛ сведений о
данном лице 9000000000002
04.05.2017
37 Полное наименование ТЕСТ ИНВЕСТМЕНТС КОРПОРЕЙШН
ЛИМИТЕД
39 Страна происхождения Республика Кипр
40 Регистрационный номер НЕ 000001
43 Размер доли (в процентах) 50
Сведения о залогодержателе доли
44 ОГРН 5000000000099
45 Полное наименование БАНК ЗАЛОГ
3
50 ГРН и дата внесения в ЕГРЮЛ сведений о
данном лице 1000000000001
18.06.2008
51 Фамилия
Имя
Отчество
КРАСНОВ
ПЁТР
СИДОРОВИЧ
52 ИНН 770000000012
53 Номинальная стоимость доли (в рублях) 1
4
Доступ к сведениям ограничен
Сведения об учете в налоговом органе
45 ИНН юридического лица ${TAX}
Страница 2 из
Выписка из ЕГРЮЛ
31.10.2026 01:11 ОГРН 10000000000012`;

const PAGES = [PAGE_1, PAGE_2];

test('the owner section gives each legal person, and only a count of a natural person', () => {
  const section = ownerSection(PAGES);
  expect(section.state).toBe('listed');
  expect(section.pages).toStrictEqual([1, 2]);
  expect(section.entries.map((entry) => entry.kind)).toStrictEqual([
    'legal_person',
    'legal_person',
    'natural_person',
    'hidden',
  ]);
  expect(section.entries[0]).toStrictEqual({
    kind: 'legal_person',
    name: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ВЛАДЕЛЕЦ"',
    ogrn: '5000000000001',
    inn: '7700000022',
    country: null,
    registrationNumber: null,
    sharePercent: '49',
    nominalRub: '8329285678.6321',
    enteredOn: '2017-10-26',
  });
  expect(section.entries[1]).toMatchObject({
    name: 'ТЕСТ ИНВЕСТМЕНТС КОРПОРЕЙШН ЛИМИТЕД',
    // The holder of a pledge on the share is not the owner.
    ogrn: null,
    country: 'Республика Кипр',
    registrationNumber: 'НЕ 000001',
    sharePercent: '50',
    enteredOn: '2017-05-04',
  });
  expect(JSON.stringify(section)).not.toMatch(/КРАСНОВ|ПЁТР|СИДОРОВИЧ|770000000012|ЗАЛОГ/u);
});

test('an extract with no owner section is absent, and a section with no known end is unread', () => {
  expect(ownerSection(['1 Полное наименование АО "ПРИМЕР"']).state).toBe('absent');
  expect(
    ownerSection([
      'Сведения об участниках / учредителях юридического лица\n1 Полное наименование X',
    ]).state,
  ).toBe('unread');
});

test('the subject of the extract is read', () => {
  expect(extractSubject(PAGES)).toStrictEqual({
    name: 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ПРИМЕР"',
    ogrn: '1000000000001',
    inn: TAX,
    endedOn: null,
  });
});

test.each([
  ['a name from a person block', 'КРАСНОВ ПЁТР'],
  ['one word of a person block', 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ КРАСНОВ'],
  ['a patronymic that no block holds', 'ООО "ПРИМЕР" ИВАНОВ ИВАН ИВАНОВИЧ'],
  ['a tax number of a person', 'ИНН 770000000012'],
  ['a label of a person', '19 Фамилия\nИмя\nОтчество'],
  ['a post', '22 Должность ДИРЕКТОР ООО "ПРИМЕР"'],
])('an excerpt with %s is refused', (_case, excerpt) => {
  expect(egrulExcerptRefusal(excerpt, PAGES)).toMatch(/sign of a natural person/u);
  // The sentence repeats no word of the excerpt.
  expect(egrulExcerptRefusal(excerpt, PAGES)).not.toMatch(/КРАСНОВ|ИВАНОВ|770000000012/u);
});

test.each([
  ['a soft hyphen', 'ООО КРАС\u00ADНОВ'],
  ['a letter with a separate mark', 'ООО П\u0415\u0308ТР'],
  ['a longer word first', 'ООО КРАСНОВСКОЕ КРАСНОВ'],
])('an excerpt with %s does not hide a name', (_case, excerpt) => {
  expect(egrulExcerptRefusal(excerpt, PAGES)).toMatch(/sign of a natural person/u);
});

test('a longer word alone passes', () => {
  expect(egrulExcerptRefusal('ООО КРАСНОВСКОЕ', PAGES)).toBeNull();
});

test('a block of a person in another layout refuses each excerpt of the document', () => {
  const other = ['19 Фамилия КРАСНОВ\n20 Имя ПЁТР'];
  expect(egrulExcerptRefusal('ООО КРАСНОВ', other)).toMatch(/could not read/u);
  expect(egrulExcerptRefusal('ОГРН 5000000000001', other)).toMatch(/could not read/u);
});

test('a label in capitals is the same label', () => {
  const other = ['19 ФАМИЛИЯ\nИМЯ\nОТЧЕСТВО\nКРАСНОВ\nПЁТР\nСИДОРОВИЧ'];
  expect(egrulExcerptRefusal('ООО КРАСНОВ', other)).toMatch(/sign of a natural person/u);
});

test('an excerpt with no form of a legal person is refused, because the rule fails closed', () => {
  expect(egrulExcerptRefusal('Размер доли (в процентах) 49', PAGES)).toMatch(/form of a legal/u);
});

test.each([
  ['a full name', 'ОБЩЕСТВО С ОГРАНИЧЕННОЙ ОТВЕТСТВЕННОСТЬЮ "ВЛАДЕЛЕЦ"'],
  ['an owner row', '21 ОГРН 5000000000001\n22 ИНН 7700000022'],
  ['a foreign company', 'ТЕСТ ИНВЕСТМЕНТС КОРПОРЕЙШН ЛИМИТЕД'],
])('an excerpt with %s passes', (_case, excerpt) => {
  expect(egrulExcerptRefusal(excerpt, PAGES)).toBeNull();
});

test('only the host of the register has this rule', () => {
  expect(isEgrulAddress(`https://egrul.nalog.ru/index.html#${TAX}`)).toBe(true);
  expect(isEgrulAddress('https://www.egrul.nalog.ru/x')).toBe(true);
  expect(isEgrulAddress('https://web.archive.org/web/2026/https://egrul.nalog.ru/x')).toBe(true);
  expect(isEgrulAddress('https://egrul.nalog.ru./x')).toBe(true);
  expect(isEgrulAddress('https://user@egrul.nalog.ru/x')).toBe(true);
  expect(isEgrulAddress('https://web.archive.org/web/2026/egrul.nalog.ru/x')).toBe(true);
  expect(isEgrulAddress('https://web.archive.org/web/2026/https%3A%2F%2Fegrul.nalog.ru%2Fx')).toBe(
    true,
  );
  expect(isEgrulAddress('https://notegrul.nalog.ru/x')).toBe(false);
  expect(isEgrulAddress('https://egrul.nalog.ru.example.org/')).toBe(false);
  expect(isEgrulAddress(null)).toBe(false);
});

// The flow, offline.

const PDF = new TextEncoder().encode('%PDF-1.7 signed extract');
const NOW = Date.parse('2026-11-06T10:00:00Z');

const tool = egrulExtractWith(() => Promise.resolve(PAGES));

interface Script {
  readonly post?: (asked: AskedPost) => WebBytes;
  readonly get?: (asked: Asked) => WebAnswer | undefined;
  readonly download?: () => WebBytes;
  readonly pages?: readonly string[];
}

const setup = (script: Script = {}) => {
  const sleeps: number[] = [];
  let now = NOW;
  const web = stubWeb(
    (asked) => {
      const given = script.get?.(asked);
      if (given !== undefined) return given;
      const path = asked.url.pathname;
      if (path.startsWith('/search-result/'))
        // A real search row names a director: the tool never repeats it.
        return json({ rows: [{ i: TAX, k: 'rowkey', g: 'ДИРЕКТОР: КРАСНОВ' }] });
      if (path.startsWith('/vyp-request/')) return json({ t: 'request', captchaRequired: false });
      if (path.startsWith('/vyp-status/')) return json({ status: 'ready' });
      return new Error(`no answer for ${path}`);
    },
    {},
    (asked) =>
      script.post?.(asked) ??
      bytes(JSON.stringify({ t: 'search', captchaRequired: false }), 200, {
        'set-cookie': 'JSESSIONID=held; Path=/',
      }),
    () => script.download?.() ?? bytes(PDF),
  );
  const session = hashDatabase();
  const reach = {
    store: memoryStore(),
    web,
    now: () => new Date(now),
    sleep: (ms: number) => {
      sleeps.push(ms);
      now += ms;
      return Promise.resolve();
    },
  };
  return { web, session, reach, sleeps, advance: (ms: number) => (now += ms) };
};

const call = (
  { session, reach }: Pick<ReturnType<typeof setup>, 'session' | 'reach'>,
  taxNumber = TAX,
): Promise<ToolOutcome> => callTool(tool, session, { taxNumber }, reach);

beforeEach(resetEgrulState);

test('one tax number runs the whole flow, and the document is stored under the provider egrul', async () => {
  const world = setup();
  const outcome = await call(world);
  expect(outcome).toMatchObject({
    ok: true,
    output: {
      status: 'stored',
      ownerSection: 'listed',
      ownerPages: [1, 2],
      ogrn: '1000000000001',
      holdSeconds: null,
    },
  });
  expect(world.web.posted[0]?.body).toContain(`query=${TAX}`);
  expect(world.web.posted[0]?.body).toContain('vyp3CaptchaToken=&');
  expect(world.web.asked.map((asked) => asked.url.pathname)).toStrictEqual([
    '/search-result/search',
    '/vyp-request/rowkey',
    '/vyp-status/request',
    '/vyp-download/request',
  ]);
  expect(world.web.asked[0]?.headers['cookie']).toBe('JSESSIONID=held');
  const [row] = world.session.stored;
  // The stored address and the title hold no token of the service.
  expect(row?.[2]).toBe(`https://egrul.nalog.ru/index.html#${TAX}`);
  expect(row?.[0]).toBe(`EGRUL extract, INN ${TAX}, OGRN 1000000000001`);
  expect(row?.[9]).toBe('egrul');
  expect(JSON.stringify(outcome)).not.toMatch(/КРАСНОВ|СИДОРОВИЧ|770000000012/u);
});

test('a 12-digit number names a natural person and reaches no host', async () => {
  const world = setup();
  const outcome = await call(world, '770000000012');
  expect(outcome.ok).toBe(false);
  expect(world.web.posted).toHaveLength(0);
});

test('a number that the register does not hold gives not_found, and no store', async () => {
  const world = setup({ get: () => json({ rows: [] }) });
  expect(await call(world)).toMatchObject({
    ok: true,
    output: { status: 'not_found', document: null },
  });
  expect(world.session.stored).toHaveLength(0);
  expect(world.web.asked).toHaveLength(1);
});

test.each<[string, Script]>([
  ['the form post', { post: () => bytes(JSON.stringify({ t: 'x', captchaRequired: true })) }],
  [
    'the request of the extract',
    {
      get: (asked) =>
        asked.url.pathname.startsWith('/vyp-request/')
          ? json({ t: 'x', captchaRequired: true })
          : undefined,
    },
  ],
  ['a status of 403', { get: () => json({}, 403) }],
  ['a status of 429', { get: () => json({}, 429) }],
  ['a page in place of the PDF', { download: () => bytes('<html>captcha</html>') }],
])(
  'a CAPTCHA at %s gives a hold with the wait time, and no further call',
  async (_case, script) => {
    const world = setup(script);
    const outcome = await call(world);
    expect(outcome).toMatchObject({
      ok: true,
      output: {
        status: 'hold',
        holdSeconds: 3600,
        retryAt: '2026-11-06T11:00:00.000Z',
        document: null,
      },
    });
    expect(world.session.stored).toHaveLength(0);
    const posts = world.web.posted.length;
    const gets = world.web.asked.length;
    // During the hold no call leaves, also with another tax number, and no new session opens.
    world.advance(1000);
    expect(await call(world, '7700000022')).toMatchObject({
      ok: true,
      output: { status: 'hold', holdSeconds: 3599 },
    });
    expect(world.web.posted).toHaveLength(posts);
    expect(world.web.asked).toHaveLength(gets);
    // After the wait the tool asks again, with the same empty field of the CAPTCHA.
    world.advance(3600 * 1000);
    await call(world);
    expect(world.web.posted.length).toBe(posts + 1);
    expect(world.web.posted.at(-1)?.body).toContain('vyp3CaptchaToken=&');
  },
);

test('a second extract waits for the pace of one per 30 s, and keeps the session', async () => {
  const world = setup();
  await call(world);
  await call(world);
  expect(world.sleeps).toStrictEqual([30_000]);
  expect(world.web.posted.at(-1)?.headers['cookie']).toBe('JSESSIONID=held');
});

test('two callers take turns', async () => {
  const world = setup();
  const order: string[] = [];
  const { web } = world;
  const slow = {
    ...world.reach,
    web: {
      ...web,
      getBytes: async (url: string, request: WebRequest) => {
        order.push('start');
        await new Promise((done) => setTimeout(done, 5));
        order.push('end');
        if (web.getBytes === undefined) throw new Error('no download');
        return web.getBytes(url, request);
      },
    },
  };
  await Promise.all([
    callTool(tool, world.session, { taxNumber: TAX }, slow),
    callTool(tool, world.session, { taxNumber: TAX }, slow),
  ]);
  expect(order).toStrictEqual(['start', 'end', 'start', 'end']);
});

test('a lease that the caller gives replaces the gate, and it ends on a fault', async () => {
  const world = setup({ download: () => bytes('not a pdf', 500) });
  const events: string[] = [];
  const outcome = await callTool(
    tool,
    world.session,
    { taxNumber: TAX },
    {
      ...world.reach,
      acquireHost: (host) => {
        events.push(`acquire ${host}`);
        return Promise.resolve(() => events.push('release'));
      },
    },
  );
  expect(outcome.ok).toBe(false);
  expect(events).toStrictEqual(['acquire egrul.nalog.ru', 'release']);
});

test('a refusal repeats no part of a body', async () => {
  const world = setup({ get: () => json({ note: 'КРАСНОВ' }, 500) });
  const outcome = await call(world);
  expect(outcome).toMatchObject({ ok: false, refusal: 'The Russian register answered 500' });
});

test('an extract of another tax number is not stored', async () => {
  const world = setup();
  const other = egrulExtractWith(() => Promise.resolve(['45 ИНН юридического лица 7700000099']));
  const outcome = await callTool(other, world.session, { taxNumber: TAX }, world.reach);
  expect(outcome.ok).toBe(false);
  expect(world.session.stored).toHaveLength(0);
});

test('each route that stores a file of the register gives it the internal provider', async () => {
  const session = hashDatabase();
  await storeAnswer(session, memoryStore(), {
    kind: 'url',
    bytes: PDF,
    mime: 'application/pdf',
    uri: 'https://egrul.nalog.ru/vyp-download/abc',
    title: 'An extract',
    pages: ['text'],
    day: '2026-11-06',
  });
  expect(session.stored[0]?.[9]).toBe('egrul');
});
