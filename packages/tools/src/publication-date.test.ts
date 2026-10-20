import { expect, test } from 'vitest';

import { dateInUrl, occurredWeekdays, weekdayOf } from './publication-date.ts';

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
