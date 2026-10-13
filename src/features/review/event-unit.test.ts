import { expect, it } from 'vitest';

import { relationWording } from '@/shared/relation-words';

import { unitChanges } from './unit-changes';
import { unitPageOf } from './unit-page';
import { UNIT_ANSWER } from './unit-sample';

const EVENT = '5b1c7e20-3a4d-4f6e-9c81-2d0a7f3b6e14';
const SITE = '6c2d8f31-4b5e-4a7f-8d92-3e1b8a4c7f25';
const ACTOR = '7d3e9a42-5c6f-4b80-9ea3-4f2c9b5d8a36';

const WORDS = {
  relation: relationWording([
    {
      key: 'occurred_at',
      label: 'occurred at',
      inverseLabel: 'is the site of',
      takesInterval: false,
      retired: false,
    },
    {
      key: 'carried_out_by',
      label: 'carried out by',
      inverseLabel: 'carries out',
      takesInterval: false,
      retired: false,
    },
  ]),
  entityType: (key: string): string => (key === 'event' ? 'Event' : key),
};

const NAME = 'claimed attack — Afipsky refinery — 2026-05-15';

// The sample unit of an army, with the acts of an event in place of its own.
const eventUnit = () => {
  const [army] = UNIT_ANSWER.units;
  if (army === undefined) throw new Error('the sample holds no unit');
  const [head, link] = army.acts;
  if (head === undefined || link === undefined) throw new Error('the sample unit holds no act');
  const attrs = {
    event_kind: { v: 'claimed attack', src: [] },
    occurred_on: { v: ['2026-05-14', '2026-05-15'], src: [] },
    occurred_on_precision: { v: 'night', src: [] },
  };
  const relation = (id: string, type: string, dst: string, name: string) => ({
    ...link,
    id,
    payload: { ...link.payload, type, src_id: EVENT, dst_id: dst },
    src: { name: NAME, state: 'pending', group: null },
    dst: { name, state: 'pending', group: null },
  });
  const read = unitPageOf(
    {
      ...UNIT_ANSWER,
      units: [
        {
          ...army,
          unit: EVENT,
          name: NAME,
          type: 'event',
          acts: [
            { ...head, id: EVENT, payload: { type: 'event', label: NAME, attrs } },
            relation(SITE, 'occurred_at', SITE, 'Afipsky refinery'),
            relation(ACTOR, 'carried_out_by', ACTOR, '1st Rocket Brigade'),
          ],
        },
      ],
    },
    null,
  );
  const found = read?.units.find((held) => held.id === EVENT);
  if (found === undefined) throw new Error('the page holds no event unit');
  return found;
};

it('shows an event with its kind, its days, its site and its actor', () => {
  const changes = unitChanges(eventUnit(), WORDS);
  expect(changes.entity).toMatchObject({ name: NAME, type: 'Event' });
  expect(changes.entity?.attributes).toStrictEqual([
    { key: 'event_kind', values: ['claimed attack'] },
    { key: 'occurred_on', values: ['2026-05-14', '2026-05-15'] },
    { key: 'occurred_on_precision', values: ['night'] },
  ]);
  expect(changes.relations.map((line) => [line.word, line.other])).toStrictEqual([
    ['occurred at', 'Afipsky refinery'],
    ['carried out by', '1st Rocket Brigade'],
  ]);
});
