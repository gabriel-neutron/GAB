import { expect, test } from 'vitest';

import { chainView } from './chain-card.ts';
import { FIXTURE_RELEASE } from './fixture-release.ts';

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const PORT = '0a1f0000-0000-4000-8000-000000000004';

test('a card reads the relations of the release with their dates, and only accepted facts', () => {
  const { cards } = chainView(FIXTURE_RELEASE.off);
  const vessel = cards[VESSEL];
  const owner = vessel?.relations.find((one) => one.otherLabel === 'Arctic Bridge Shipping');
  expect(owner).toMatchObject({ words: 'is owned by', from: '2024-03-01', to: '' });
  const past = vessel?.relations.find((one) => one.otherLabel === 'Baltic Tanker Holding');
  expect(past).toMatchObject({ from: '2019-06-01', to: '2024-03-01' });
  expect(vessel?.relations.some((one) => one.otherLabel === 'Gulf Ship Management')).toBe(false);
  expect(vessel?.inReview).toBe(6);
});

test('an entity that is only proposed has no stage and shows no fact', () => {
  const view = chainView(FIXTURE_RELEASE.off);
  expect(view.stages.get(PORT)).toBeNull();
  expect(view.cards[PORT]?.relations).toEqual([]);
  expect(view.cards[PORT]?.values).toEqual([]);
  expect(view.cards[PORT]?.inReview).toBe(3);
});
