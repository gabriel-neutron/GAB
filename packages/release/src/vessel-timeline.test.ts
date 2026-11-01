import { expect, test } from 'vitest';

import { timelineAxis } from './timeline-axis.ts';
import { readSiteRelease } from './site-release.ts';
import type { SiteClaim, SiteRelation, SiteRelease } from './site-release.ts';
import { vesselLanes } from './vessel-timeline.ts';

const VESSEL = 'vessel';

const trust = { originLabel: 'o', licence: 'l', sources: [], pair: null } as const;

const berthed = (id: string): SiteRelation => ({
  id,
  type: 'berthed_at',
  fromId: VESSEL,
  fromLabel: 'Vessel',
  toId: 'port',
  toLabel: 'Port',
  validFrom: null,
  validTo: null,
  originLabel: 'o',
  licence: 'l',
});

const callClaim = (relation: SiteRelation): SiteClaim => ({
  ...trust,
  id: `claim-${relation.id}`,
  kind: 'relation',
  relation,
});

const observed = (relation: SiteRelation, value: string): SiteClaim => ({
  ...trust,
  id: `value-${relation.id}`,
  kind: 'attribute',
  subjectKind: 'relation',
  subjectId: relation.id,
  subjectLabel: 'call',
  attribute: 'observed_on',
  value,
});

const FIXTURE = import.meta.glob<string>('../../site/fixtures/release/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const fixed = readSiteRelease(
  new Map(Object.entries(FIXTURE).map(([path, text]) => [path.split('/').pop() ?? path, text])),
);

/** The fixed release, with the claims of the test vessel replaced by one port call per entry: its
 * day value, or none. */
const releaseOf = (calls: readonly (string | null)[]): SiteRelease => {
  const relations = calls.map((_, index) => berthed(`r${String(index)}`));
  return {
    ...fixed,
    claimsAbout: new Map([[VESSEL, relations.map(callClaim)]]),
    valuesOfRelation: new Map(
      relations.flatMap((relation, index) => {
        const value = calls[index];
        return value === null || value === undefined
          ? []
          : [[relation.id, [observed(relation, value)]] as const];
      }),
    ),
  };
};

test('a value that is not a day gives a mark with no date, and the axis draws no interval', () => {
  const lanes = vesselLanes(releaseOf(['2026-02-30', 'last week', '']), VESSEL);

  expect(lanes.flatMap(({ marks }) => marks.map(({ time }) => time.kind))).toEqual([
    'no date',
    'no date',
    'no date',
  ]);
  expect(timelineAxis(lanes, '2026-06-01')).toBeNull();
});

test('events out of order are sorted by day, and a mark with no date goes last', () => {
  const lanes = vesselLanes(releaseOf(['2024-05-01', null, '2023-01-01', '2023-12-31']), VESSEL);
  const days = lanes.flatMap(({ marks }) =>
    marks.map(({ time }) => (time.kind === 'day' ? time.day : time.kind)),
  );

  expect(days).toEqual(['2023-01-01', '2023-12-31', '2024-05-01', 'no date']);
});
