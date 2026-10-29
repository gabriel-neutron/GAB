import { expect, test } from 'vitest';

import {
  dateInUrl,
  occurredWeekdays,
  weekdayOf,
  withOfacReleaseDate,
  isUkListDate,
} from './publication-date.ts';

test('a day gives its weekday in English', () => {
  expect(weekdayOf('2026-05-12')).toBe('Tuesday');
  expect(weekdayOf('2026-05-11')).toBe('Monday');
});

test('a text that is no real day gives no weekday', () => {
  expect(weekdayOf('2026-02-30')).toBeNull();
  expect(weekdayOf('May 12')).toBeNull();
});

test('a date in the path of a URL is the date of publication', () => {
  expect(dateInUrl('https://news.example/2026/05/13/strike-at-plant')).toBe('2026-05-13');
  expect(dateInUrl('https://news.example/news/2026-05-13-strike')).toBe('2026-05-13');
  expect(dateInUrl('https://news.example/world/20260513/strike')).toBe('2026-05-13');
  expect(dateInUrl('https://news.example/2026/5/3/strike')).toBe('2026-05-03');
});

test('a URL with no date, a false date or no address gives no date', () => {
  expect(dateInUrl('https://news.example/world/strike-at-plant')).toBeNull();
  expect(dateInUrl('https://news.example/2026/13/45/strike')).toBeNull();
  expect(dateInUrl('https://news.example/post/12345678')).toBeNull();
  expect(dateInUrl('https://news.example/a?date=2026-05-13')).toBeNull();
  expect(dateInUrl('not an address')).toBeNull();
  expect(dateInUrl(null)).toBeNull();
});

test('the claimed days of an act come with their weekdays', () => {
  const act = {
    op: 'create_entity',
    attrs: { occurred_on: { v: ['2026-05-11', '2026-05-12'] } },
  };
  expect(occurredWeekdays(act)).toStrictEqual([
    { day: '2026-05-11', weekday: 'Monday' },
    { day: '2026-05-12', weekday: 'Tuesday' },
  ]);
  expect(occurredWeekdays({ attrs: { occurred_on: { v: '2026-05-12' } } })).toStrictEqual([
    { day: '2026-05-12', weekday: 'Tuesday' },
  ]);
});

test('an act with no claimed day gives no weekday', () => {
  expect(occurredWeekdays({ op: 'create_entity' })).toStrictEqual([]);
  expect(occurredWeekdays({ attrs: { occurred_on: { v: '2026-05' } } })).toStrictEqual([]);
  expect(occurredWeekdays('text')).toStrictEqual([]);
});

test('the Release Date of an OFAC page of recent actions is month/day/year', () => {
  const uri = 'https://ofac.treasury.gov/recent-actions/20220802';
  expect(withOfacReleaseDate(uri, 'Release Date: 08/02/2022\n\nThe Department')).toBe(
    'Release Date: 2022-08-02\n\nThe Department',
  );
  expect(withOfacReleaseDate(uri, 'Release Date: 04/06/2018')).toBe('Release Date: 2018-04-06');
});

test('another date of an OFAC page, and another page, stay as they are', () => {
  const ofac = 'https://ofac.treasury.gov/recent-actions/20220802';
  expect(withOfacReleaseDate(ofac, 'made on 08/02/2022')).toBe('made on 08/02/2022');
  expect(withOfacReleaseDate('https://example.org/a', 'Release Date: 08/02/2022')).toBe(
    'Release Date: 08/02/2022',
  );
});

test('a passage of the UK Sanctions List reads day/month/year by its host or its label', () => {
  const host = 'https://search-uk-sanctions-list.service.gov.uk/entity/RUS1426';
  expect(isUkListDate(host, 'designated 04/05/2022')).toBe(true);
  expect(isUkListDate('https://example.org/a', 'Date Designated: 04/05/2022')).toBe(true);
  expect(isUkListDate('https://example.org/a', 'Date Designated: 25/05/2022')).toBe(true);
  expect(isUkListDate('https://example.org/a', 'made on 04/05/2022')).toBe(false);
  expect(isUkListDate(null, 'made on 04/05/2022')).toBe(false);
  expect(isUkListDate('https://sanctionslist.fcdo.gov.uk', 'x')).toBe(true);
});
