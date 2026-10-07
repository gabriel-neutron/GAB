import { expect, test } from 'vitest';

import { faultMarks } from './fault-marks';
import type { Fault } from './unit-page';

const fault = (kind: Fault['kind'], level: Fault['level'], said = 'a sentence'): Fault => ({
  kind,
  level,
  act: null,
  said,
});

test('each kind of fault has one short mark, in the order of the faults', () => {
  expect(
    faultMarks([
      fault('end_waits', 'blocks'),
      fault('circle', 'blocks'),
      fault('end_relation_waits', 'blocks'),
      fault('end_rejected', 'blocks'),
      fault('end_missing', 'blocks'),
      fault('self', 'blocks'),
      fault('no_source', 'blocks'),
      fault('end_waits_in_group', 'waits'),
      fault('dispute', 'not_clean'),
      fault('contradiction', 'not_clean'),
      fault('reported_claim', 'not_clean'),
      fault('duplicate', 'not_clean'),
      fault('unknown_type', 'not_clean'),
      fault('rejected_before', 'not_clean'),
      fault('sources_from_parent', 'information'),
      fault('approximate_position', 'information'),
      fault('note', 'information'),
      fault('same_name', 'information'),
    ]).map((mark) => mark.words),
  ).toStrictEqual([
    'waits',
    'circle',
    'waits for a relation',
    'end rejected',
    'end missing',
    'points to itself',
    'no passage',
    'parent first',
    'disputed',
    'two values',
    'reported claim',
    'duplicate',
    'unknown type',
    'rejected before',
    'sources from the parent',
    'approximate position',
    'note',
    'same name',
  ]);
});

test('two faults of one kind give one mark, and the mark keeps the level of the fault', () => {
  expect(
    faultMarks([
      fault('end_waits', 'blocks', 'Waits for 5th Army (group 5th Army)'),
      fault('end_waits', 'blocks', 'Waits for Eastern Military District (no group)'),
      fault('note', 'information'),
    ]),
  ).toStrictEqual([
    { kind: 'end_waits', level: 'blocks', words: 'waits' },
    { kind: 'note', level: 'information', words: 'note' },
  ]);
});

test('a clean unit with no fault has no mark', () => {
  expect(faultMarks([])).toStrictEqual([]);
});
