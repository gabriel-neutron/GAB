import { expect, test } from 'vitest';

import { documentType, DOCUMENT_TYPES, hostOf } from './document-type.ts';

test.each([
  [
    'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R0012',
    'Regulation',
    'legal_act',
  ],
  ['https://www.federalregister.gov/documents/2026/05/03/x/designations', 'Notice', 'legal_act'],
  ['https://www.legislation.gov.uk/uksi/2026/12/made', 'The Order 2026', 'legal_act'],
  ['https://example.org/a', 'Council Implementing Regulation (EU) 2026/12', 'legal_act'],
  ['https://example.org/a', 'Executive Order 14024', 'legal_act'],
  ['https://sanctionslistservice.ofac.treas.gov/api/x/SDN.CSV', 'SDN list', 'register_entry'],
  [
    'https://find-and-update.company-information.service.gov.uk/company/123',
    'Co',
    'register_entry',
  ],
  ['https://search.gleif.org/#/record/5493001KJTIIGC8Y1R12', 'Record', 'register_entry'],
  ['https://home.treasury.gov/news/press-releases/jy1234', 'Treasury action', 'press_release'],
  ['https://example.org/a', 'Press release: a new designation', 'press_release'],
  ['https://example.org/media/news/2026/ship', 'A ship was seized', 'other'],
  ['https://example.org/files/annual.pdf', 'Annual report 2025', 'report'],
  ['https://example.org/reports/2025', 'Overview', 'report'],
  ['https://example.org/a', 'A page', 'other'],
  [null, 'A note', 'other'],
])('the type of %s with the title %s is %s', (uri, title, type) => {
  expect(documentType({ uri, title, provider: null })).toBe(type);
});

test('a provider of an official list decides the type', () => {
  expect(documentType({ uri: null, title: 'x', provider: 'ofac_sdn' })).toBe('register_entry');
  expect(documentType({ uri: null, title: 'x', provider: 'uk_sanctions_list' })).toBe(
    'register_entry',
  );
  expect(documentType({ uri: null, title: 'x', provider: 'eu_eurlex' })).toBe('legal_act');
});

test('each type is one of the eleven', () => {
  expect(DOCUMENT_TYPES).toStrictEqual([
    'legal_act',
    'register_entry',
    'press_release',
    'report',
    'official_publication',
    'reference',
    'company_publication',
    'telegram_post',
    'ngo_publication',
    'news_article',
    'other',
  ]);
});

test('the host of an address has no www, and a bad address has none', () => {
  expect(hostOf('https://www.example.org/a?b=1')).toBe('example.org');
  expect(hostOf('https://Sub.Example.org:8080/a')).toBe('sub.example.org');
  expect(hostOf('not an address')).toBeNull();
  expect(hostOf(null)).toBeNull();
});

// The hosts that the sources of the claims use: the channels and the previews of Telegram, the
// NGO and think-tank sites, and the news sites. At most 5% of them may be `other`.
const SOURCE_HOSTS: readonly (readonly [string, string])[] = [
  ['t.me', 'telegram_post'],
  ['telegram.me', 'telegram_post'],
  ['tgstat.ru', 'telegram_post'],
  ['bruegel.org', 'ngo_publication'],
  ['globalenergymonitor.org', 'ngo_publication'],
  ['globalfishingwatch.org', 'ngo_publication'],
  ['amnesty.org', 'ngo_publication'],
  ['hrw.org', 'ngo_publication'],
  ['transparency.org', 'ngo_publication'],
  ['globalwitness.org', 'ngo_publication'],
  ['c4ads.org', 'ngo_publication'],
  ['bellingcat.com', 'ngo_publication'],
  ['energyandcleanair.org', 'ngo_publication'],
  ['kse.ua', 'ngo_publication'],
  ['reuters.com', 'news_article'],
  ['bloomberg.com', 'news_article'],
  ['ft.com', 'news_article'],
  ['bbc.com', 'news_article'],
  ['kyivindependent.com', 'news_article'],
  ['themoscowtimes.com', 'news_article'],
  ['meduza.io', 'news_article'],
  ['kommersant.ru', 'news_article'],
  ['rbc.ru', 'news_article'],
  ['interfax.ru', 'news_article'],
  ['tass.ru', 'news_article'],
  ['lloydslist.com', 'news_article'],
  ['tradewindsnews.com', 'news_article'],
  ['splash247.com', 'news_article'],
  ['theguardian.com', 'news_article'],
  ['politico.eu', 'news_article'],
  ['bbc.co.uk', 'news_article'],
  ['nytimes.com', 'news_article'],
  ['wsj.com', 'news_article'],
  ['ukrinform.net', 'news_article'],
  ['pravda.com.ua', 'news_article'],
  ['ria.ru', 'news_article'],
  ['kyivpost.com', 'news_article'],
  ['sputnikglobe.com', 'news_article'],
  ['csis.org', 'ngo_publication'],
  ['rusi.org', 'ngo_publication'],
  ['acleddata.com', 'ngo_publication'],
  ['reddit.com', 'other'],
  ['example.org', 'other'],
];

test.each(SOURCE_HOSTS)('the host %s is %s', (host, type) => {
  expect(documentType({ uri: `https://www.${host}/a/b`, title: 'A page', provider: null })).toBe(
    type,
  );
});

test('a sub-domain of a news host is a news article', () => {
  const uri = 'https://sub.reuters.com/world/x';
  expect(documentType({ uri, title: 'A page', provider: null })).toBe('news_article');
});

test('a Telegram address of a post is a telegram post', () => {
  expect(documentType({ uri: 'https://t.me/s/channel/123', title: 'x', provider: null })).toBe(
    'telegram_post',
  );
});

test('a news headline with the word report is a news article', () => {
  const uri = 'https://www.reuters.com/world/x';
  expect(documentType({ uri, title: 'Report says the cap fails', provider: null })).toBe(
    'news_article',
  );
});

test('a Telegram page with press release in the title is a telegram post', () => {
  const uri = 'https://t.me/s/channel/1';
  expect(documentType({ uri, title: 'Press release', provider: null })).toBe('telegram_post');
});

test('at most 5% of the hosts of the sources are other', () => {
  const other = SOURCE_HOSTS.filter(
    ([host]) => documentType({ uri: `https://${host}/`, title: '', provider: null }) === 'other',
  );
  expect(other.length / SOURCE_HOSTS.length).toBeLessThanOrEqual(0.05);
});

// The hosts that were `other` on the release of 23 October 2026, with the number of claim rows of
// each. A host that no rule can type stays `other`, and the weighted share of those rows has a limit.
const COUNTED_HOSTS: readonly (readonly [string, number, string])[] = [
  ['sanctionslist.fcdo.gov.uk', 1153, 'register_entry'],
  ['govinfo.gov', 919, 'legal_act'],
  ['ofac.treasury.gov', 871, 'register_entry'],
  ['assets.publishing.service.gov.uk', 336, 'official_publication'],
  ['sanctionssearch.ofac.treas.gov', 281, 'register_entry'],
  ['search-uk-sanctions-list.service.gov.uk', 206, 'register_entry'],
  ['en.wikipedia.org', 111, 'reference'],
  ['gov.uk', 110, 'official_publication'],
  ['war-sanctions.gur.gov.ua', 106, 'official_publication'],
  ['gem.wiki', 102, 'reference'],
  ['ukrinform.ua', 92, 'news_article'],
  ['ru.wikipedia.org', 90, 'reference'],
  ['api.openstreetmap.org', 83, 'reference'],
  ['web.archive.org', 79, 'other'],
  ['treasury.gov', 77, 'official_publication'],
  ['kremlin.ru', 38, 'official_publication'],
  ['gcaptain.com', 31, 'news_article'],
  ['icra.in', 31, 'other'],
  ['nominatim.openstreetmap.org', 30, 'reference'],
  ['rosneft.de', 30, 'company_publication'],
  ['mero.cz', 29, 'company_publication'],
  ['kyivpost.com', 27, 'news_article'],
  ['cpc-online.ru', 24, 'company_publication'],
  ['rosneft.com', 24, 'company_publication'],
  ['2021-2025.state.gov', 24, 'official_publication'],
  ['economictimes.indiatimes.com', 23, 'news_article'],
  ['lukoil.com', 23, 'company_publication'],
  ['tupras.com.tr', 21, 'company_publication'],
];

test.each(COUNTED_HOSTS)('the host %s (%i rows) is %s', (host, _rows, type) => {
  expect(documentType({ uri: `https://${host}/a`, title: 'A page', provider: null })).toBe(type);
});

test('the rows of the counted hosts are at most 5% other', () => {
  const total = COUNTED_HOSTS.reduce((sum, [, rows]) => sum + rows, 0);
  const other = COUNTED_HOSTS.filter(
    ([host]) => documentType({ uri: `https://${host}/`, title: '', provider: null }) === 'other',
  ).reduce((sum, [, rows]) => sum + rows, 0);
  expect(other / total).toBeLessThanOrEqual(0.05);
});

test('an archived page has the type of the page that it keeps', () => {
  const uri = 'https://web.archive.org/web/20250101000000/https://www.reuters.com/world/x';
  expect(documentType({ uri, title: 'A page', provider: null })).toBe('news_article');
  const none = 'https://web.archive.org/web/20250101000000/';
  expect(documentType({ uri: none, title: 'A page', provider: null })).toBe('other');
});

test('a headline that names an executive order on a news host is a news article', () => {
  const uri = 'https://www.reuters.com/world/x';
  expect(documentType({ uri, title: 'Executive order bans X', provider: null })).toBe(
    'news_article',
  );
});

test('a reference page titled as an executive order is a reference', () => {
  const uri = 'https://en.wikipedia.org/wiki/Executive_Order_14024';
  expect(documentType({ uri, title: 'Executive order 14024', provider: null })).toBe('reference');
});
