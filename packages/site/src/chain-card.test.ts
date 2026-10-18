import { expect, test } from 'vitest';

import { chainView } from '@gab/release/chain-card';
import { ACCEPTED_STRIKE, SITE, STRIKE } from './event-fixture.ts';
import { FIXTURE_RELEASE } from './fixture-release.ts';

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const PORT = '0a1f0000-0000-4000-8000-000000000004';

test('a card reads the relations of the release with their dates, and marks each fact in review', () => {
  const { cards } = chainView(FIXTURE_RELEASE.off);
  const vessel = cards[VESSEL];
  expect(vessel?.inReview).toBe(false);
  const owner = vessel?.relations.find((one) => one.otherLabel === 'Arctic Bridge Shipping');
  expect(owner).toMatchObject({
    words: 'is owned by',
    from: '2024-03-01',
    to: '',
    inReview: false,
  });
  const past = vessel?.relations.find((one) => one.otherLabel === 'Baltic Tanker Holding');
  expect(past).toMatchObject({ from: '2019-06-01', to: '2024-03-01', inReview: false });
  const proposed = vessel?.relations.find((one) => one.otherLabel === 'Gulf Ship Management');
  expect(proposed).toMatchObject({ inReview: true, label: 'Proposed — not checked' });
});

test('in each list of a card, the accepted facts come before the facts in review', () => {
  const vessel = chainView(FIXTURE_RELEASE.off).cards[VESSEL];
  for (const list of [vessel?.values ?? [], vessel?.relations ?? []]) {
    const flags = list.map((one) => one.inReview);
    expect(flags).toStrictEqual([...flags].sort((one, two) => Number(one) - Number(two)));
  }
});

test('an entity that is only proposed has no stage, and each of its facts is in review', () => {
  const view = chainView(FIXTURE_RELEASE.off);
  const port = view.cards[PORT];
  expect(view.stages.get(PORT)).toBeNull();
  expect(port?.inReview).toBe(true);
  expect(port?.relations.length).toBeGreaterThan(0);
  expect(port?.relations.every((one) => one.inReview)).toBe(true);
});

test('a vessel has no sanctions status', () => {
  expect(chainView(FIXTURE_RELEASE.off).cards[VESSEL]?.sanctions).toBeNull();
});

test('a port with no measure has a status with no measure in each regime', () => {
  const sanctions = chainView(FIXTURE_RELEASE.off).cards[PORT]?.sanctions;
  expect(sanctions?.map((one) => one.measures.length)).toStrictEqual([0, 0, 0]);
});

test('a facility gives the status of each regime: the measure, the act and its date, or no measure', () => {
  const sanctions = chainView(FIXTURE_RELEASE.events).cards[SITE]?.sanctions;
  expect(sanctions?.map((one) => one.regime)).toStrictEqual(['EU', 'US', 'UK']);
  expect(sanctions?.[0]?.measures).toStrictEqual([
    {
      id: 'eu designated_by 0a1f0000-0000-4000-8000-000000000060 2025-05-20',
      measure: 'Listed',
      via: '',
      act: 'Council of the European Union, Council Implementing Regulation (EU) 2025/0000',
      from: '2025-05-20',
      to: '',
      label: 'Accepted by rule strong_sources v2 — no person read it',
      inReview: false,
    },
  ]);
  expect(sanctions?.[1]?.measures).toMatchObject([
    { measure: 'Listed', via: 'operator Arctic Bridge Shipping', from: '', inReview: false },
  ]);
  expect(sanctions?.[2]?.measures).toMatchObject([
    { measure: 'Sectoral measure', act: 'HM Treasury, UK sanctions list', inReview: true },
  ]);
});

test('a card gives each strike at the site with its days and the documents that report it', () => {
  const strikes = chainView(FIXTURE_RELEASE.events).cards[SITE]?.strikes;
  expect(strikes).toStrictEqual([
    {
      id: ACCEPTED_STRIKE,
      days: '2026-03-02',
      reportedBy: ['A report of news'],
      label: 'Accepted by rule strong_sources v2 — no person read it',
      inReview: false,
    },
    {
      id: STRIKE,
      days: '2026-05-14 to 2026-05-15',
      reportedBy: ['A report of news'],
      label: 'Proposed — not checked',
      inReview: true,
    },
  ]);
});
