// The check of a value in its cited passage. Another form of the same value passes. A different
// value, or a form with two readings, marks the item as disputed: a wrong pass is never allowed.

import { writeRequest } from '@gab/proposal/request';
import { expect, test } from 'vitest';

import { unstatedValues } from './stated-value.ts';

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
])('the passage %j states the day %s', (passage, day) => {
  expect(unstatedValues(relationFrom(day), [passage])).toStrictEqual([]);
});

test.each([
  ['Listed on 03/04/2024.', '2024-04-03'],
  ['Listed on 03/04/2024.', '2024-03-04'],
  ['On 12 March 2024 the tanker left.', '2024-03-13'],
  ['On 112 March 2024 the tanker left.', '2024-03-12'],
  ['Listed on 2024-03-12.', '2024-12-03'],
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
