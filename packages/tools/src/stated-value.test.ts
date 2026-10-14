// The check of a value in its cited passage. Another form of the same value passes. A different
// value, or a form with two readings, marks the item as disputed: a wrong pass is never allowed.

import { writeRequest } from '@gab/proposal/request';
import { expect, test } from 'vitest';

import {
  daysFromPublication,
  namesProvision,
  statedBounds,
  unstatedValues,
} from './stated-value.ts';

const relationFrom = (validFrom: string) =>
  writeRequest.parse({
    op: 'create_relation',
    type: 'owns',
    srcId: '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    dstId: '4f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    validFrom,
  });

const entityWith = (label: string, value: string | number) =>
  writeRequest.parse({ op: 'create_entity', type: 'vessel', label, attrs: { dwt: { v: value } } });

test.each([
  ['On 12 March 2024 the tanker left.', '2024-03-12'],
  ['Le 12 mars 2024, le navire est parti.', '2024-03-12'],
  ['Since March 12, 2024 it sails.', '2024-03-12'],
  ['Le 1er févr. 2024', '2024-02-01'],
  ['Listed on 2024-03-12.', '2024-03-12'],
  ['Listed on 25/03/2024.', '2024-03-25'],
  ['Listed on 03/25/2024.', '2024-03-25'],
  ['Listed on 05.05.2024.', '2024-05-05'],
  ['Listed on 05.03.2024.', '2024-03-05'],
  ['В силу с 5.3.2024.', '2024-03-05'],
  ['Судно продано 2 мая 2019 г.', '2019-05-02'],
  ['с 30 ноября 2023 года', '2023-11-30'],
  ['On the 2nd of May, 2019 she was sold.', '2019-05-02'],
  ['Sold on 2 May, 2019.', '2019-05-02'],
  ['Listed 02-May-2019.', '2019-05-02'],
  ['Listed 02-MAY-2019.', '2019-05-02'],
])('the passage %j states the day %s', (passage, day) => {
  expect(unstatedValues(relationFrom(day), [passage])).toStrictEqual([]);
});

test.each([
  ['Listed on 03/04/2024.', '2024-04-03'],
  ['Listed on 03/04/2024.', '2024-03-04'],
  ['On 12 March 2024 the tanker left.', '2024-03-13'],
  ['On 112 March 2024 the tanker left.', '2024-03-12'],
  ['Listed on 2024-03-12.', '2024-12-03'],
  ['Listed on 05.03.2024.', '2024-05-03'],
  ['Listed on 05-03-2024.', '2024-03-05'],
])('the passage %j does not state the day %s', (passage, day) => {
  expect(unstatedValues(relationFrom(day), [passage])).toStrictEqual([
    { name: 'validFrom', value: day },
  ]);
});

test.each([
  ['A tanker of 41 200 dwt.', 41_200],
  ['A tanker of 41,200,000 dwt.', 41_200_000],
  ['A tanker of 1.234.567 dwt.', 1_234_567],
  ['A tanker of 1,234.5 dwt.', 1234.5],
  ['A tanker of 1.234,5 dwt.', 1234.5],
  ['A tanker of 12,5 dwt.', 12.5],
  ['A tanker of 1000 dwt.', 1000],
  ['A tanker of 41200 dwt.', '41 200'],
])('the passage %j states the number %s', (passage, value) => {
  expect(unstatedValues(entityWith('tanker', value), [passage])).toStrictEqual([]);
});

test.each([
  ['A tanker of 1,000 dwt.', 1000],
  ['A tanker of 1.000 dwt.', 1000],
  ['A tanker of 1,000 dwt.', 1],
  ['A tanker of 1.000 dwt.', 1],
  ['A tanker of 1000 dwt.', 100],
  ['A tanker of 1000 dwt.', '100'],
  ['A tanker of 1 000 dwt.', '100'],
  ['A tanker of 41 200 dwt.', 41],
  ['In 2024 41 tanker trips.', 202_441],
])('the passage %j does not state the number %s', (passage, value) => {
  expect(unstatedValues(entityWith('tanker', value), [passage])).toStrictEqual([
    { name: 'attrs.dwt', value },
  ]);
});

test.each([
  ['ROSNEFT, PJSC owns it.', 'Rosneft PJSC'],
  ['Rosneft S.A. owns it.', 'Rosneft SA'],
  ['Société Générale owns it.', 'SOCIETE GENERALE'],
  ['Ros-\nneft owns it.', 'Rosneft'],
])('the passage %j states the name %s', (passage, label) => {
  expect(unstatedValues(entityWith(label, 1), [`${passage} 1`])).toStrictEqual([]);
});

test.each([
  ['Rosneftegaz owns it.', 'Rosneft'],
  ['Rosneft owns it.', 'Ros'],
  ['Lukoil owns it.', 'Rosneft'],
])('the passage %j does not state the name %s', (passage, label) => {
  expect(unstatedValues(entityWith(label, 1), [`${passage} 1`])).toStrictEqual([
    { name: 'label', value: label },
  ]);
});

const flagged = (value: boolean) =>
  writeRequest.parse({
    op: 'create_entity',
    type: 'vessel',
    label: 'tanker',
    attrs: { sanctioned: { v: value } },
  });

test.each([
  ['The tanker is sanctioned: yes.', true],
  ['Sanctioned: true', true],
  ['Sanctionné : oui', true],
  ['Sanctioned: no.', false],
  ['Sanctioned: false', false],
  ['Sanctionné : non', false],
])('the passage %j states the yes or no %s', (passage, value) => {
  expect(unstatedValues(flagged(value), [`tanker ${passage}`])).toStrictEqual([]);
});

test.each([
  ['The tanker left port.', true],
  ['The tanker left port.', false],
  ['Sanctioned: yes.', false],
  ['Sanctioned: no.', true],
])('the passage %j does not state the yes or no %s', (passage, value) => {
  expect(unstatedValues(flagged(value), [`tanker ${passage}`])).toStrictEqual([
    { name: 'attrs.sanctioned', value },
  ]);
});

test.each([
  ['The margin is -5 tonnes.', -5],
  ['The margin is \u22125 tonnes.', -5],
  ['The margin is minus 5 tonnes.', -5],
  ['La marge est de moins 5 tonnes.', -5],
  ['The margin is 5 tonnes.', 5],
])('the passage %j states the number %s', (passage, value) => {
  expect(unstatedValues(entityWith('tanker', value), [`tanker ${passage}`])).toStrictEqual([]);
});

test.each([
  ['The margin is 5 tonnes.', -5],
  ['Pages 3-5 of the register.', -5],
])('the passage %j does not state the number %s', (passage, value) => {
  expect(unstatedValues(entityWith('tanker', value), [`tanker ${passage}`])).toStrictEqual([
    { name: 'attrs.dwt', value },
  ]);
});

const unitWith = (number: string) =>
  writeRequest.parse({
    op: 'create_entity',
    type: 'military_unit',
    label: 'regiment',
    attrs: { military_unit_number: { v: number } },
  });

test.each([
  ['419th Guards Motor Rifle Training Regiment (military unit 30616-4)', '30616-4'],
  ['the regiment, military unit 30616-4.', '30616-4'],
])('the passage %j states the identifier %s', (passage, value) => {
  expect(unstatedValues(unitWith(value), [`regiment ${passage}`])).toStrictEqual([]);
});

test.each([
  ['419th Guards Motor Rifle Training Regiment (military unit 30616-45)', '30616-4'],
  ['419th Guards Motor Rifle Training Regiment (military unit 30616-4-1)', '30616-4'],
  ['419th Guards Motor Rifle Training Regiment (military unit 130616-4)', '30616-4'],
  ['419th Guards Motor Rifle Training Regiment (military unit 30616)', '30616-4'],
])('the passage %j does not state the identifier %s', (passage, value) => {
  expect(unstatedValues(unitWith(value), [`regiment ${passage}`])).toStrictEqual([
    { name: 'attrs.military_unit_number', value },
  ]);
});

test.each([
  ['A tanker of 1 000 000 dwt.', '1 000'],
  ['A tanker of 1 200 000 dwt.', '200 000'],
  ["A tanker of 1'000'000 dwt.", "1'000"],
  ['A tanker - of 1000 dwt.', '-'],
  ['Unit 30616-4:1 of the regiment.', '30616-4'],
  ['Unit 30616-4+1 of the regiment.', '30616-4'],
  ['Unit A 1 000 000 of the regiment.', 'A 1 000'],
])('the passage %j does not state the text %s', (passage, value) => {
  expect(unstatedValues(unitWith(value), [`regiment ${passage}`])).toStrictEqual([
    { name: 'attrs.military_unit_number', value },
  ]);
});

const relationBetween = (bounds: { validFrom?: string; validTo?: string }) =>
  writeRequest.parse({
    op: 'create_relation',
    type: 'owns',
    srcId: '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    dstId: '4f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    ...bounds,
  });

test('a relation keeps the start and the end that its passage states', () => {
  const act = relationBetween({ validFrom: '2019-05-02', validTo: '2023-11-30' });
  expect(
    statedBounds(act, ['Rosneft owned her from 2 May 2019 to 30 November 2023.']),
  ).toStrictEqual({ act, dropped: [] });
});

test('a bound that no passage states is not proposed, and the other bound stays', () => {
  const act = relationBetween({ validFrom: '2019-05-02', validTo: '2023-11-30' });
  expect(statedBounds(act, ['Rosneft owned her from 2 May 2019.'])).toStrictEqual({
    act: relationBetween({ validFrom: '2019-05-02' }),
    dropped: ['validTo'],
  });
  expect(statedBounds(act, ['She left Rosneft on 30 November 2023.'])).toStrictEqual({
    act: relationBetween({ validTo: '2023-11-30' }),
    dropped: ['validFrom'],
  });
});

test('an act with no bound is kept as it is', () => {
  const act = writeRequest.parse({ op: 'create_entity', type: 'vessel', label: 'Nayara' });
  expect(statedBounds(act, ['the tanker NAYARA'])).toStrictEqual({ act, dropped: [] });
});

const closing = writeRequest.parse({
  op: 'update_relation',
  targetId: '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
  validTo: '2023-11-30',
});

test('the end of a close stays in the act, and it is named when no passage states it', () => {
  expect(statedBounds(closing, ['She left Rosneft on 30 November 2023.'])).toStrictEqual({
    act: closing,
    dropped: [],
  });
  expect(statedBounds(closing, ['She left Rosneft in 2023.'])).toStrictEqual({
    act: closing,
    dropped: ['validTo'],
  });
});

const starting = writeRequest.parse({
  op: 'update_relation',
  targetId: '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
  validFrom: '2024-02-23',
});

test('the start that an act gives to a relation stays in the act, and it is named when no passage states it', () => {
  expect(
    statedBounds(starting, ['OFAC designated the vessel on February 23, 2024.']),
  ).toStrictEqual({ act: starting, dropped: [] });
  expect(statedBounds(starting, ['OFAC designated the vessel.'])).toStrictEqual({
    act: starting,
    dropped: ['validFrom'],
  });
});

test('a passage names a provision by the number of a directive, an annex or an article', () => {
  expect(namesProvision(['Directive 4 under Executive Order 14024'])).toBe(true);
  expect(namesProvision(['listed in Annex XLVII to Regulation (EU) No 833/2014'])).toBe(true);
  expect(namesProvision(['prohibited by Article 5 of the Regulation'])).toBe(true);
  expect(namesProvision(['the bank is restricted', 'an annex follows'])).toBe(false);
});

test('the type form of a change keeps its act, and no end is named', () => {
  const retyping = writeRequest.parse({
    op: 'update_relation',
    targetId: '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    type: 'restricted_by',
  });
  expect(statedBounds(retyping, ['Directive 4'])).toStrictEqual({ act: retyping, dropped: [] });
});

// The Ukrainian months stand in the genitive case, as in "15 травня 2024 року".
test.each([
  ['січня', '2024-01-15'],
  ['лютого', '2024-02-15'],
  ['березня', '2024-03-15'],
  ['квітня', '2024-04-15'],
  ['травня', '2024-05-15'],
  ['червня', '2024-06-15'],
  ['липня', '2024-07-15'],
  ['серпня', '2024-08-15'],
  ['вересня', '2024-09-15'],
  ['жовтня', '2024-10-15'],
  ['листопада', '2024-11-15'],
  ['грудня', '2024-12-15'],
])('the Ukrainian month %s gives the day %s', (month, day) => {
  expect(unstatedValues(relationFrom(day), [`15 ${month} 2024 року`])).toStrictEqual([]);
});

test('a Ukrainian month is a different month than its neighbor', () => {
  expect(unstatedValues(relationFrom('2024-06-15'), ['15 травня 2024 року'])).toHaveLength(1);
});

const NIGHT = 'Росія атакувала порт у ніч на 15 травня.';
const PUBLISHED = { publishedOn: '2024-05-15' };

test.each(['2024-05-14', '2024-05-15'])('the night of 14 to 15 May states the day %s', (day) => {
  expect(unstatedValues(relationFrom(day), [NIGHT], PUBLISHED)).toStrictEqual([]);
});

test('a night with no year takes the year of the publication date', () => {
  expect(unstatedValues(relationFrom('2023-05-15'), [NIGHT], PUBLISHED)).toHaveLength(1);
  expect(unstatedValues(relationFrom('2023-05-14'), [NIGHT], PUBLISHED)).toHaveLength(1);
  expect(unstatedValues(relationFrom('2024-05-13'), [NIGHT], PUBLISHED)).toHaveLength(1);
});

test('a night that ends on 1 January starts in the previous year', () => {
  const passage = 'Атака була у ніч на 1 січня.';
  const options = { publishedOn: '2025-01-01' };
  expect(unstatedValues(relationFrom('2025-01-01'), [passage], options)).toStrictEqual([]);
  expect(unstatedValues(relationFrom('2024-12-31'), [passage], options)).toStrictEqual([]);
  expect(unstatedValues(relationFrom('2025-12-31'), [passage], options)).toHaveLength(1);
  expect(unstatedValues(relationFrom('2024-01-01'), [passage], options)).toHaveLength(1);
});

test('a night with no year takes the latest year that is not after the publication day', () => {
  const passage = 'Атака була у ніч на 20 грудня.';
  const options = { publishedOn: '2025-01-05' };
  expect(unstatedValues(relationFrom('2024-12-20'), [passage], options)).toStrictEqual([]);
  expect(unstatedValues(relationFrom('2025-12-20'), [passage], options)).toHaveLength(1);
  const later = 'Атака була у ніч на 16 травня.';
  expect(
    unstatedValues(relationFrom('2023-05-16'), [later], { publishedOn: '2024-05-15' }),
  ).toStrictEqual([]);
  expect(
    unstatedValues(relationFrom('2024-05-16'), [later], { publishedOn: '2024-05-15' }),
  ).toHaveLength(1);
});

test('a night that ends on 29 February takes the latest year that has the day', () => {
  expect(
    unstatedValues(relationFrom('2024-02-29'), ['у ніч на 29 лютого'], {
      publishedOn: '2025-03-01',
    }),
  ).toStrictEqual([]);
});

test('a publication date that is no day states nothing', () => {
  expect(
    unstatedValues(relationFrom('2024-05-15'), [NIGHT], { publishedOn: 'yesterday' }),
  ).toHaveLength(1);
});

test('the days that only the publication date states are named', () => {
  const act = relationFrom('2024-05-15');
  expect(daysFromPublication(act, [NIGHT], '2024-05-15')).toStrictEqual(['2024-05-15']);
  expect(daysFromPublication(act, [NIGHT], undefined)).toStrictEqual([]);
  expect(daysFromPublication(act, ['у ніч на 15 травня 2024'], '2024-05-15')).toStrictEqual([]);
  expect(daysFromPublication(act, ['15 May 2024'], '2024-05-15')).toStrictEqual([]);
});

test('the end of a close that takes its year from the publication day is named', () => {
  const passage = 'Вона залишила Роснефть у ніч на 30 листопада.';
  expect(daysFromPublication(closing, [passage], '2023-11-30')).toStrictEqual(['2023-11-30']);
  expect(daysFromPublication(closing, [passage], undefined)).toStrictEqual([]);
});

test('a night on 2 January published on 1 January goes to the previous year', () => {
  const options = { publishedOn: '2025-01-01' };
  expect(
    unstatedValues(relationFrom('2024-01-02'), ['Атака у ніч на 2 січня.'], options),
  ).toStrictEqual([]);
  expect(
    unstatedValues(relationFrom('2025-01-02'), ['Атака у ніч на 2 січня.'], options),
  ).toHaveLength(1);
});

test('a night on 29 February published on 29 February is that day', () => {
  expect(
    unstatedValues(relationFrom('2024-02-29'), ['у ніч на 29 лютого'], {
      publishedOn: '2024-02-29',
    }),
  ).toStrictEqual([]);
});

test('a night on the publication day itself stays in that year', () => {
  expect(
    unstatedValues(relationFrom('2024-05-15'), [NIGHT], { publishedOn: '2024-05-15' }),
  ).toStrictEqual([]);
});

test('a night with no year and no publication date stays contested', () => {
  expect(unstatedValues(relationFrom('2024-05-15'), [NIGHT])).toHaveLength(1);
  expect(unstatedValues(relationFrom('2024-05-14'), [NIGHT])).toHaveLength(1);
  expect(
    unstatedValues(relationFrom('2024-05-15'), [NIGHT], { publishedOn: undefined }),
  ).toHaveLength(1);
});

test('a night with a year uses that year', () => {
  expect(
    unstatedValues(relationFrom('2022-05-14'), ['у ніч на 15 травня 2022 року'], PUBLISHED),
  ).toStrictEqual([]);
});

test('a Ukrainian day with no year and no night stays contested', () => {
  expect(unstatedValues(relationFrom('2024-05-15'), ['15 травня'], PUBLISHED)).toHaveLength(1);
});

test('a publication date does not change the formats that the reader knew', () => {
  expect(
    unstatedValues(relationFrom('2024-03-12'), ['On 12 March 2024 the tanker left.'], {
      publishedOn: '2020-01-01',
    }),
  ).toStrictEqual([]);
});

const eventOf = (label: string) =>
  writeRequest.parse({
    op: 'create_entity',
    type: 'event',
    label,
    attrs: {
      event_kind: { v: 'claimed attack' },
      occurred_on: { v: ['2026-05-14', '2026-05-15'] },
      occurred_on_precision: { v: 'night' },
    },
  });

test('the name, the kind and the precision of an event are no value that a passage states', () => {
  const passage = 'Росія атакувала порт у ніч на 15 травня 2026.';
  expect(
    unstatedValues(eventOf('claimed attack — Port of Tuapse — 2026-05-15'), [passage]),
  ).toStrictEqual([]);
});

test('the days of an event are checked against the passage', () => {
  const passage = 'Росія атакувала порт у ніч на 16 травня 2026.';
  expect(
    unstatedValues(eventOf('claimed attack — Port of Tuapse — 2026-05-15'), [passage]).map(
      (one) => one.name,
    ),
  ).toStrictEqual(['attrs.occurred_on']);
});

test('another type keeps the check of the attributes that are words of the event list', () => {
  const act = writeRequest.parse({
    op: 'create_entity',
    type: 'facility',
    label: 'Port of Tuapse',
    attrs: {
      event_kind: { v: 'claimed attack' },
      occurred_on_precision: { v: 'night' },
    },
  });
  expect(unstatedValues(act, ['Port of Tuapse is a port.']).map((one) => one.name)).toStrictEqual([
    'attrs.event_kind',
    'attrs.occurred_on_precision',
  ]);
});

test('a slash date of the FCDO UK Sanctions List is day/month, and elsewhere it has two readings', () => {
  const act = relationBetween({ validFrom: '2025-05-09' });
  const passage = ['Date Designated: 09/05/2025'];
  expect(statedBounds(act, passage, { dayFirst: true })).toStrictEqual({ act, dropped: [] });
  expect(unstatedValues(act, passage, { dayFirst: true })).toStrictEqual([]);
  expect(
    statedBounds(relationBetween({ validFrom: '2025-09-05' }), passage, { dayFirst: true }),
  ).toStrictEqual({ act: relationBetween({}), dropped: ['validFrom'] });
  expect(statedBounds(act, passage)).toStrictEqual({
    act: relationBetween({}),
    dropped: ['validFrom'],
  });
});
