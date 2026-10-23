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

test('each type is one of the eight', () => {
  expect(DOCUMENT_TYPES).toStrictEqual([
    'legal_act',
    'register_entry',
    'press_release',
    'report',
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

test('a report on a news host stays a report', () => {
  const uri = 'https://www.reuters.com/reports/2025';
  expect(documentType({ uri, title: 'Overview', provider: null })).toBe('report');
});

test('at most 5% of the hosts of the sources are other', () => {
  const other = SOURCE_HOSTS.filter(
    ([host]) => documentType({ uri: `https://${host}/`, title: '', provider: null }) === 'other',
  );
  expect(other.length / SOURCE_HOSTS.length).toBeLessThanOrEqual(0.05);
});
