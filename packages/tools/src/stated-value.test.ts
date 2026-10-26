// The check of a value in its cited passage. Another form of the same value passes. A different
// value, or a form with two readings, marks the item as disputed: a wrong pass is never allowed.

import { writeRequest } from '@gab/proposal/request';
import { expect, test } from 'vitest';

import {
  daysFromPublication,
  namesProvision,
  statedBounds,
  unstatedCallDay,
  unstatedValues,
  codedIdentifier,
  withCodedJurisdiction,
  withoutCallDay,
} from './stated-value.ts';
import { assetKindRefusal } from './propose.ts';

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
  ['OFAC action of 14 August 2025', 'The OFAC action of August 14, 2025 lists it.'],
  ['OFAC action of August 14, 2025', 'OFAC action of 14 August 2025'],
  ['OFAC action of 14 August 2025', 'OFAC action of August 14 2025'],
  ['OFAC action of August 14 2025', 'OFAC action of 14 August, 2025'],
])('the value %j and the passage %j state the same day', (value, passage) => {
  expect(unstatedValues(entityWith(value, value), [passage])).toStrictEqual([]);
});

test('a label with another day is not stated', () => {
  expect(
    unstatedValues(entityWith('OFAC action of 14 August 2025', 'OFAC action of 14 August 2025'), [
      'OFAC action of August 15, 2025',
    ]),
  ).toHaveLength(2);
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

test('a Ukrainian day with no year and no night takes the year of the publication, and the item stays disputed', () => {
  expect(unstatedValues(relationFrom('2024-05-15'), ['15 травня'], PUBLISHED)).toStrictEqual([]);
  expect(
    daysFromPublication(relationFrom('2024-05-15'), ['15 травня'], '2024-05-15'),
  ).toStrictEqual(['2024-05-15']);
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

const companyIn = (jurisdiction: string) =>
  writeRequest.parse({
    op: 'create_entity',
    type: 'company',
    label: 'Gazpromneft Aero',
    attrs: { registration_jurisdiction: { v: jurisdiction } },
  });

test.each(['Russia', 'Russian Federation', 'RU'])(
  'a source that writes %j states the jurisdiction RU',
  (spelling) => {
    expect(
      unstatedValues(companyIn('RU'), [`Gazpromneft Aero, address: Moscow, ${spelling}`]),
    ).toStrictEqual([]);
  },
);

test('a source that names another country does not state the jurisdiction RU', () => {
  expect(unstatedValues(companyIn('RU'), ['Gazpromneft Aero, Belarus'])).toHaveLength(1);
});

test.each(['Russia', 'Russian Federation', 'RU'])(
  'the spelling %j is written as RU',
  (spelling) => {
    const coded = withCodedJurisdiction(companyIn(spelling));
    expect(
      coded.op === 'create_entity' && coded.attrs?.['registration_jurisdiction'],
    ).toStrictEqual({
      v: 'RU',
    });
  },
);

test('an unknown jurisdiction keeps its spelling', () => {
  const coded = withCodedJurisdiction(companyIn('Narnia'));
  expect(coded.op === 'create_entity' && coded.attrs?.['registration_jurisdiction']).toStrictEqual({
    v: 'Narnia',
  });
});

test('a list of jurisdictions is coded one by one, and a Russian source states RU', () => {
  const coded = withCodedJurisdiction(
    writeRequest.parse({
      op: 'create_entity',
      type: 'company',
      label: 'Gazpromneft Aero',
      attrs: { registration_jurisdiction: { v: ['Russia', 'Narnia'] } },
    }),
  );
  expect(coded.op === 'create_entity' && coded.attrs?.['registration_jurisdiction']).toStrictEqual({
    v: ['RU', 'Narnia'],
  });
  expect(
    unstatedValues(companyIn('RU'), ['Gazpromneft Aero. Страна регистрации: Российская Федерация']),
  ).toStrictEqual([]);
});

test('a list keeps each code once, in its first place', () => {
  const coded = withCodedJurisdiction(
    writeRequest.parse({
      op: 'create_entity',
      type: 'company',
      label: 'Gazpromneft Aero',
      attrs: { registration_jurisdiction: { v: ['Russia', 'Narnia', 'RU', 'Russian Federation'] } },
    }),
  );
  expect(coded.op === 'create_entity' && coded.attrs?.['registration_jurisdiction']).toStrictEqual({
    v: ['RU', 'Narnia'],
  });
});

test('an identifier search reads a jurisdiction as its code, and each other key as it is', () => {
  expect(codedIdentifier('registration_jurisdiction', 'Russian Federation')).toBe('RU');
  expect(codedIdentifier('registration_jurisdiction', 'Narnia')).toBe('Narnia');
  expect(codedIdentifier('tax_id', 'Russia')).toBe('Russia');
});

const placeAt = (lon: number, lat: number) =>
  writeRequest.parse({
    op: 'update_entity',
    targetId: '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    geom: { type: 'Point', coordinates: [lon, lat] },
  });

test.each([
  ["RU  ULU  Ust'-Luga  5940N 02819E", 28.3167, 59.6667],
  ['Latitude 59.6681, Longitude 28.3122', 28.3167, 59.6667],
  ['the port lies at 59°40′ N, 28°19′ E', 28.3167, 59.6667],
  ['the port lies at 59,6681 N, 28,3122 E', 28.3167, 59.6667],
  ['Leningrad Oblast,60.523347000000001,28.130122,exact', 28.130122, 60.523347],
  // Degrees and decimal minutes with a comma or a dot, as a port authority writes a berth.
  ['причал № 1: 60°20,02′ с.ш. 28°42,58′ в.д.', 28.70967, 60.33367],
  ["berth 1: 60° 20.02' N, 28° 42.58' E", 28.70967, 60.33367],
  // A Cyrillic or a Latin letter o in place of the degree sign.
  ['60о20,02′ с.ш., 28о42,58′ в.д.', 28.70967, 60.33367],
  ["60o20,02' N, 28o42,58' E", 28.70967, 60.33367],
  // Degrees, minutes and seconds, with a decimal comma or dot in the seconds.
  ['69°03′11″ N, 58°09′07,5″ E', 58.15208, 69.05306],
  ['69о03\'11" с.ш., 58о09\'07.5" в.д.', 58.15208, 69.05306],
  // The compact degrees, minutes and seconds of a port register.
  ['RUVAR-0001 690311N 0580907E', 58.15194, 69.05306],
  // The nautical form: degrees and minutes with a hyphen, and the hemisphere letter after them.
  ['Position 60-20.02N 028-07.50E', 28.125, 60.33367],
  ['Position 60-20,02 N, 28-07-30 E', 28.125, 60.33367],
])('the passage %j states the point', (passage, lon, lat) => {
  expect(unstatedValues(placeAt(lon, lat), [passage])).toStrictEqual([]);
});

test('a hyphen range with no hemisphere letter is no nautical position', () => {
  expect(unstatedValues(placeAt(28, 60), ['Berths 60-20 and 28-07 are free.']).length).toBe(2);
});

test('minutes of 60 or more are no nautical position', () => {
  expect(unstatedValues(placeAt(28, 60), ['Position 60-99N 28-75E']).length).toBe(2);
});

test.each(['60 of 20 berths, 28 of 42 tanks', 'el 60º aniversario, 28o año', '5o, 60o, 28о.'])(
  'a letter o or an ordinal sign with no minutes after it is no degree sign: %j',
  (passage) => {
    expect(unstatedValues(placeAt(28, 60), [passage]).map((one) => one.name)).toStrictEqual([
      'geom.longitude',
      'geom.latitude',
    ]);
  },
);

test('the place of a new entity is checked against the passage', () => {
  const created = writeRequest.parse({
    op: 'create_entity',
    type: 'facility',
    label: 'Orsk refinery',
    geom: { type: 'Point', coordinates: [58.511982, 51.254268] },
  });
  expect(unstatedValues(created, ['Orsk refinery, 51.254268, 58.511982'])).toStrictEqual([]);
  expect(
    unstatedValues(created, ['Orsk refinery, 51.9, 58.511982']).map((one) => one.name),
  ).toStrictEqual(['geom.latitude']);
});

test('a point that the passage does not state is unstated, coordinate by coordinate', () => {
  expect(
    unstatedValues(placeAt(28.3167, 45.1), ["RU  ULU  Ust'-Luga  5940N 02819E"]).map(
      (one) => one.name,
    ),
  ).toStrictEqual(['geom.latitude']);
  expect(
    unstatedValues(placeAt(28.3167, 59.6667), ['left Sikka on 12 March 2024']).map(
      (one) => one.name,
    ),
  ).toStrictEqual(['geom.longitude', 'geom.latitude']);
  expect(
    unstatedValues(placeAt(23.13, 23.34), ['Leningrad Oblast,60.523347000000001,28.130122']).map(
      (one) => one.name,
    ),
  ).toStrictEqual(['geom.longitude', 'geom.latitude']);
});

test.each([
  ['59.6667 N, 28.1301 E', 28.1301, 59.6667],
  ['59.6667 S, 28.1301 W', -28.1301, -59.6667],
  ['59.6667 N, 28.1301 W', -28.1301, 59.6667],
  ['59°40′ S, 28°19′ E', 28.3167, -59.6667],
  ['RU  ULU  5940S 02819W', -28.3167, -59.6667],
  ['0580907W 690311N', -58.15194, 69.05306],
])('the passage %j states the point with its hemispheres', (passage, lon, lat) => {
  expect(unstatedValues(placeAt(lon, lat), [passage])).toStrictEqual([]);
});

test.each([
  ['a wrong hemisphere in latitude', 28.1301, -59.6667, ['geom.latitude']],
  ['a wrong hemisphere in longitude', -28.1301, 59.6667, ['geom.longitude']],
  ['a swapped latitude and longitude', 59.6667, 28.1301, ['geom.longitude', 'geom.latitude']],
])('a lettered coordinate never states %s', (_case, lon, lat, names) => {
  expect(
    unstatedValues(placeAt(lon, lat), ['Terminal at 59.6667 N, 28.1301 E']).map((one) => one.name),
  ).toStrictEqual(names);
});

test('a compact coordinate with a letter keeps its axis and its hemisphere', () => {
  const passage = ["RU  ULU  Ust'-Luga  5940N 02819E"];
  expect(unstatedValues(placeAt(28.3167, -59.6667), passage)).toHaveLength(1);
  expect(unstatedValues(placeAt(59.6667, 28.3167), passage)).toHaveLength(2);
});

test('a coordinate with no letter states either axis and either sign', () => {
  expect(unstatedValues(placeAt(-60.523347, -28.130122), ['x,60.523347,28.130122'])).toStrictEqual(
    [],
  );
  expect(unstatedValues(placeAt(28.130122, 60.523347), ['x,60.523347,28.130122'])).toStrictEqual(
    [],
  );
});

const callOf = (type: string, observedOn?: string | string[]) =>
  writeRequest.parse({
    op: 'create_relation',
    type,
    srcId: '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    dstId: '4f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    ...(observedOn === undefined ? {} : { attrs: { observed_on: { v: observedOn } } }),
  });

test.each([
  ['a day with a month word', 'The tanker loaded at Sikka on 19 May 2026.', '2026-05-19', false],
  ['a day with dots', 'The tanker loaded at Sikka on 19.05.2026.', '2026-05-19', false],
  ['a month only', 'The tanker loaded at Sikka in May 2026.', '2026-05-19', true],
  ['a text with no date', 'The tanker loaded at Sikka.', '2026-05-19', true],
  ['another day than the text', 'The tanker loaded at Sikka on 20 May 2026.', '2026-05-19', true],
  ['a month as the value', 'The tanker loaded at Sikka in May 2026.', '2026-05', true],
  ['a day that is not in the calendar', 'It loaded on 30 February 2026.', '2026-02-30', true],
])('the day of a port call: %s', (_case, passage, day, unstated) => {
  expect(unstatedCallDay(callOf('loads_at', day), [passage])).toBe(unstated);
});

test('a list of days is not the day of a port call', () => {
  const act = callOf('discharges_at', ['2026-05-19', '2026-05-20']);
  expect(unstatedCallDay(act, ['On 19 May 2026 and on 20 May 2026.'])).toBe(true);
});

test('the day of a port call takes its year from the publication day, as the other days do', () => {
  const act = callOf('berthed_at', '2026-05-15');
  const night = ['у ніч на 15 травня судно стало до причалу'];
  expect(unstatedCallDay(act, night)).toBe(true);
  expect(unstatedCallDay(act, night, { publishedOn: '2026-05-15' })).toBe(false);
});

test('the check of the day is for a port call with a day only', () => {
  expect(unstatedCallDay(callOf('loads_at'), ['No date.'])).toBe(false);
  expect(unstatedCallDay(callOf('flagged_falsely', '2026-05-19'), ['No date.'])).toBe(false);
  expect(unstatedCallDay(entityWith('NAYARA', 5), ['No date.'])).toBe(false);
});

test('a port call with no day keeps its other attributes', () => {
  const act = writeRequest.parse({
    op: 'create_relation',
    type: 'loads_at',
    srcId: '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    dstId: '4f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    attrs: { observed_on: { v: '2026-05-19' }, cargo: { v: 'crude' } },
  });
  expect(withoutCallDay(act)).toMatchObject({ attrs: { cargo: { v: 'crude' } } });
  expect(withoutCallDay(act)).not.toHaveProperty('attrs.observed_on');
  expect(withoutCallDay(callOf('loads_at', '2026-05-19'))).not.toHaveProperty('attrs');
});

// Real excerpts of stored Reuters documents: doc_36e638d26604, doc_ed1cabe98546, doc_d94ce1cf864b.
const RYAZAN = [
  "MOSCOW, Feb 24 (Reuters) - Russia's Ryazan oil refinery has suspended operations after an attack by Ukrainian drones on Monday, three industry sources told Reuters.",
  "Ukraine's military said on Monday some of its drones had hit the Ryazan oil refinery overnight",
];
const NIGHT_OF = (first: string, second: string) =>
  writeRequest.parse({
    op: 'create_entity',
    type: 'event',
    label: `claimed attack — Ryazan Refinery — ${second}`,
    attrs: {
      event_kind: { v: 'claimed attack' },
      occurred_on: { v: [first, second] },
      occurred_on_precision: { v: 'night' },
    },
  });

test('a dateline and "overnight" state the night that ends on the dateline day', () => {
  const options = { publishedOn: '2025-02-24' };
  expect(unstatedValues(NIGHT_OF('2025-02-23', '2025-02-24'), RYAZAN, options)).toStrictEqual([]);
  expect(unstatedValues(NIGHT_OF('2025-02-24', '2025-02-25'), RYAZAN, options)).toHaveLength(1);
});

test('a dateline with no year states nothing without a publication date', () => {
  expect(unstatedValues(NIGHT_OF('2025-02-23', '2025-02-24'), RYAZAN)).toHaveLength(2);
});

test('a dateline with no night word states no day', () => {
  const passage =
    "KYIV, Sept 5 (Reuters) - Ukraine attacked Russia's Ryazan oil refinery, the commander of its drone forces, Robert Brovdi, said on messaging app Telegram on Friday, as well as an oil depot in the occupied Luhansk region.";
  const options = { publishedOn: '2025-09-05' };
  expect(unstatedValues(NIGHT_OF('2025-09-04', '2025-09-05'), [passage], options)).toHaveLength(2);
  expect(unstatedValues(relationFrom('2025-09-05'), [passage], options)).toHaveLength(1);
});

test('"early-morning" is no night word', () => {
  const passages = [
    'MOSCOW, Sept 20 (Reuters) - The largest Ukrainian drone attack reported so far on the Moscow region killed three people and damaged part of an oil refinery in the capital, authorities said on Sunday',
    'Two people were killed in the early-morning attacks and a third died of his injuries later in hospital',
  ];
  expect(
    unstatedValues(NIGHT_OF('2026-09-19', '2026-09-20'), passages, { publishedOn: '2026-09-20' }),
  ).toHaveLength(2);
});

test('a dateline and "overnight" state no day of a relation or a port call', () => {
  const options = { publishedOn: '2025-02-24' };
  expect(unstatedValues(relationFrom('2025-02-23'), RYAZAN, options)).toHaveLength(1);
  expect(statedBounds(relationFrom('2025-02-23'), RYAZAN, options).dropped).toStrictEqual([
    'validFrom',
  ]);
  const call = writeRequest.parse({
    op: 'create_relation',
    type: 'loads_at',
    srcId: '3f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    dstId: '4f2b8c1e-5d4a-4e6f-8a7b-1c2d3e4f5a6b',
    attrs: { observed_on: { v: '2025-02-23' } },
  });
  expect(unstatedCallDay(call, RYAZAN, options)).toBe(true);
});

test('"Saturday night" and "last night" name another night', () => {
  const options = { publishedOn: '2025-02-24' };
  for (const words of ['on Saturday night', 'last night'])
    expect(
      unstatedValues(
        NIGHT_OF('2025-02-23', '2025-02-24'),
        [`MOSCOW, Feb 24 (Reuters) - Drones hit the Ryazan oil refinery ${words}.`],
        options,
      ),
    ).toHaveLength(2);
});

test('the night of a dateline is named as a day from the publication date', () => {
  expect(
    daysFromPublication(NIGHT_OF('2025-02-23', '2025-02-24'), RYAZAN, '2025-02-24'),
  ).toStrictEqual(['2025-02-23', '2025-02-24']);
});

// Real excerpts of stored documents: doc_0b306287fb32 (Reuters) and doc_82746201e328 (ISW).
const YANOS = [
  "Sept 17 (Reuters) - Russia's Slavneft Yaroslavnefteorgsintez (YANOS) oil refinery halted crude processing on Thursday following a Ukrainian drone attack that damaged equipment at the facility",
  "Ukraine hit Russia's Yaroslavl oil refinery overnight, ​Ukrainian President Volodymyr Zelenskiy said on Thursday.",
];
const RYAZAN_ISW = [
  'Ukrainian forces continued their long-range strike campaign against Russian oil infrastructure on the night of September 5 to 6.',
];

test('a dateline with no city and "overnight" state the night that ends on the dateline day', () => {
  const options = { publishedOn: '2026-09-17' };
  expect(unstatedValues(NIGHT_OF('2026-09-16', '2026-09-17'), YANOS, options)).toStrictEqual([]);
  expect(unstatedValues(NIGHT_OF('2026-09-17', '2026-09-18'), YANOS, options)).toHaveLength(1);
});

test('"the night of September 5 to 6" states the two days of the night', () => {
  const options = { publishedOn: '2026-09-06' };
  expect(unstatedValues(NIGHT_OF('2026-09-05', '2026-09-06'), RYAZAN_ISW, options)).toStrictEqual(
    [],
  );
  expect(unstatedValues(NIGHT_OF('2026-09-05', '2026-09-06'), RYAZAN_ISW)).toHaveLength(2);
  expect(
    daysFromPublication(NIGHT_OF('2026-09-05', '2026-09-06'), RYAZAN_ISW, '2026-09-06'),
  ).toStrictEqual(['2026-09-05', '2026-09-06']);
});

test('a night of two days with a year and the "overnight on" form state the night', () => {
  for (const words of ['on the night of September 5 to 6, 2026', 'overnight on September 5 to 6'])
    expect(
      unstatedValues(NIGHT_OF('2026-09-05', '2026-09-06'), [`Drones struck ${words}.`], {
        publishedOn: '2026-09-06',
      }),
    ).toStrictEqual([]);
  expect(
    unstatedValues(NIGHT_OF('2026-09-05', '2026-09-06'), [
      'Drones struck on the night of September 5 to 6, 2026.',
    ]),
  ).toStrictEqual([]);
});

test('a night of two days that are not side by side states nothing', () => {
  expect(
    unstatedValues(NIGHT_OF('2026-09-05', '2026-09-06'), ['on the night of September 4 to 6'], {
      publishedOn: '2026-09-06',
    }),
  ).toHaveLength(2);
});

test('a dateline with no city states no day without a night word, or for a relation', () => {
  const options = { publishedOn: '2026-09-17' };
  expect(
    unstatedValues(NIGHT_OF('2026-09-16', '2026-09-17'), [YANOS[0] ?? ''], options),
  ).toHaveLength(2);
  expect(unstatedValues(relationFrom('2026-09-16'), YANOS, options)).toHaveLength(1);
});

test.each([
  ['The tanker loaded at Ust-Luga on Jan. 7.', '2025-01-07'],
  ['It discharged at Beihai on June 28th.', '2024-06-28'],
  ['Le navire a chargé le 7 janvier.', '2025-01-07'],
  ['Танкер загрузился 28 июня.', '2024-06-28'],
])('a day with no year in "%s" takes the year of the publication day', (passage, day) => {
  const options = { publishedOn: '2025-02-01' };
  expect(unstatedValues(relationFrom(day), [passage], options)).toStrictEqual([]);
  expect(daysFromPublication(relationFrom(day), [passage], '2025-02-01')).toStrictEqual([day]);
  expect(unstatedValues(relationFrom(day), [passage])).toHaveLength(1);
});

test('a day with a year never takes the year of the publication day', () => {
  const options = { publishedOn: '2025-02-01' };
  expect(unstatedValues(relationFrom('2024-06-28'), ['June 28, 2019'], options)).toHaveLength(1);
  expect(unstatedValues(relationFrom('2024-06-28'), ['28 June 2019'], options)).toHaveLength(1);
  expect(unstatedValues(relationFrom('2024-06-28'), ['June 28th, 2019'], options)).toHaveLength(1);
  expect(unstatedValues(relationFrom('2025-01-07'), ['Jan. 7th 2019'], options)).toHaveLength(1);
});

test.each([
  'MOSCOW, Feb 24 (Reuters) - Exports rose.',
  'MOSCOW, February 24. /TASS/. Exports rose.',
  'МОСКВА, 24 февраля. /ТАСС/. Экспорт вырос.',
  'KYIV, Feb 24 /Ukrinform/. Exports rose.',
])('a news dateline with no year states no day: %s', (passage) => {
  expect(
    unstatedValues(relationFrom('2025-02-24'), [passage], { publishedOn: '2025-02-24' }),
  ).toHaveLength(1);
});

test.each(['Article 5 may apply.', 'Лист 2 отчёта.'])('"%s" states no day', (passage) => {
  const options = { publishedOn: '2025-12-31' };
  expect(unstatedValues(relationFrom('2025-05-05'), [passage], options)).toHaveLength(1);
  expect(unstatedValues(relationFrom('2025-11-02'), [passage], options)).toHaveLength(1);
});

test('a day that the text writes as 03/04/2024 stays in doubt, also with a publication day', () => {
  const options = { publishedOn: '2024-05-01' };
  expect(unstatedValues(relationFrom('2024-04-03'), ['on 03/04/2024'], options)).toHaveLength(1);
  expect(unstatedValues(relationFrom('2024-03-04'), ['on 03/04/2024'], options)).toHaveLength(1);
});

test('the asset kind is a word of the closed list, and no passage states it in that form', () => {
  const act = (op: 'create_entity' | 'update_attrs') =>
    writeRequest.parse(
      op === 'create_entity'
        ? {
            op,
            type: 'facility',
            label: 'Kirishi refinery',
            attrs: { asset_kind: { v: 'refinery' } },
          }
        : {
            op,
            targetKind: 'entity',
            targetId: '0a1f0000-0000-4000-8000-000000000001',
            attrs: { asset_kind: { v: 'refinery' } },
          },
    );
  expect(unstatedValues(act('create_entity'), ['Kirishi refinery (KINEF).'])).toStrictEqual([]);
  expect(unstatedValues(act('update_attrs'), ['Киришский НПЗ.'])).toStrictEqual([]);
});

test('propose refuses an asset kind that is not a word of the closed list', () => {
  const facility = (kind: string) =>
    writeRequest.parse({
      op: 'create_entity',
      type: 'facility',
      label: 'Kirishi refinery',
      attrs: { asset_kind: { v: kind } },
    });
  expect(assetKindRefusal(facility('refinery'))).toBeNull();
  expect(assetKindRefusal(facility('oil refinery'))).toMatch(/^asset_kind is one of: field, /u);
  const company = writeRequest.parse({
    op: 'create_entity',
    type: 'company',
    label: 'Novatek',
    attrs: { asset_kind: { v: 'export_terminal' } },
  });
  expect(assetKindRefusal(company)).toBe('only a facility or a port has an asset_kind');
});

test.each([
  ['Yesterday a drone hit the plant.', '2025-02-23'],
  ['Tonight a drone hit the plant.', '2025-02-24'],
  ['Вчора дрони вразили НПЗ.', '2025-02-23'],
  ['Сьогодні вночі дрони вразили НПЗ.', '2025-02-24'],
])('"%s" states the day by the publication day', (passage, day) => {
  const options = { publishedOn: '2025-02-24' };
  expect(unstatedValues(relationFrom(day), [passage], options)).toStrictEqual([]);
  expect(unstatedValues(relationFrom('2025-02-22'), [passage], options)).toHaveLength(1);
  // With no publication day, a relative word states nothing.
  expect(unstatedValues(relationFrom(day), [passage])).toHaveLength(1);
});

test('a relative word states no day when the passage writes a day', () => {
  const options = { publishedOn: '2025-02-24' };
  const passage = 'Today the ministry said the strike was on 3 February 2025.';
  expect(unstatedValues(relationFrom('2025-02-24'), [passage], options)).toHaveLength(1);
});

test('"yesterday" crosses the end of a month and of a year', () => {
  expect(
    unstatedValues(relationFrom('2024-12-31'), ['Yesterday a drone hit it.'], {
      publishedOn: '2025-01-01',
    }),
  ).toStrictEqual([]);
});
