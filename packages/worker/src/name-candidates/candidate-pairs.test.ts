import { expect, test } from 'vitest';

import { candidatePairs } from './candidate-pairs.ts';

const A = '10000000-0000-4000-8000-000000000001';
const B = '20000000-0000-4000-8000-000000000002';
const C = '30000000-0000-4000-8000-000000000003';
const D = '40000000-0000-4000-8000-000000000004';

test('a Latin and a Cyrillic name of one type with one key make one pair, the smaller identifier first', () => {
  expect(
    candidatePairs([
      { entityId: B, type: 'company', name: 'ПАО «Совкомфлот»' },
      { entityId: A, type: 'company', name: 'Sovcomflot' },
    ]),
  ).toStrictEqual([
    {
      firstId: A,
      secondId: B,
      type: 'company',
      key: 'sovkomflot',
      firstName: 'Sovcomflot',
      secondName: 'ПАО «Совкомфлот»',
    },
  ]);
});

test('two entities of two types, or two names in one script, make no pair', () => {
  expect(
    candidatePairs([
      { entityId: A, type: 'port', name: 'Primorsk' },
      { entityId: B, type: 'facility', name: 'Приморск' },
      { entityId: C, type: 'company', name: 'Sovcomflot' },
      { entityId: D, type: 'company', name: 'SOVCOMFLOT PJSC' },
    ]),
  ).toStrictEqual([]);
});

test('the Latin label and the Cyrillic name of one entity make no pair', () => {
  expect(
    candidatePairs([
      { entityId: A, type: 'company', name: 'Rosneft' },
      { entityId: A, type: 'company', name: 'Роснефть' },
    ]),
  ).toStrictEqual([]);
});

test('a pair that two names match is one pair, and an alias in the other script counts', () => {
  expect(
    candidatePairs([
      { entityId: A, type: 'company', name: 'Rosneft' },
      { entityId: A, type: 'company', name: 'Роснефть' },
      { entityId: B, type: 'company', name: 'НК Роснефть' },
      { entityId: B, type: 'company', name: 'Rosneft Oil' },
      { entityId: B, type: 'company', name: 'Роснефть' },
      { entityId: C, type: 'company', name: 'Rosneft Oil Company' },
    ]),
  ).toStrictEqual([
    {
      firstId: A,
      secondId: B,
      type: 'company',
      key: 'rosneft',
      firstName: 'Rosneft',
      secondName: 'Роснефть',
    },
  ]);
});

test('a name with no key and a name in two scripts make no pair', () => {
  expect(
    candidatePairs([
      { entityId: A, type: 'company', name: 'ООО' },
      { entityId: B, type: 'company', name: 'OOO' },
      { entityId: C, type: 'company', name: 'Kinef КИНЕФ' },
      { entityId: D, type: 'company', name: 'Kinef' },
    ]),
  ).toStrictEqual([]);
});

test('the names of two persons pair in any order of the words', () => {
  expect(
    candidatePairs([
      { entityId: A, type: 'person', name: 'Ivanov Ivan' },
      { entityId: B, type: 'person', name: 'Иван Иванов' },
    ]),
  ).toStrictEqual([
    {
      firstId: A,
      secondId: B,
      type: 'person',
      key: 'ivan ivanov',
      firstName: 'Ivanov Ivan',
      secondName: 'Иван Иванов',
    },
  ]);
});
