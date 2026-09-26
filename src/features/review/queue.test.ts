import { describe, expect, it } from 'vitest';

import { corpus } from '@/shared/committed-fixture/corpus';
import type { Corpus, Proposal } from '@/shared/read/model';

import { readQueue, type Change } from './queue';

const TERMINAL = 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8';

const THRESHOLD = 0.5;

const actOf = (id: string, confidence: number | null, dissent: boolean): Proposal => ({
  id,
  op: 'update_attrs',
  targetKind: 'entity',
  targetId: TERMINAL,
  payload: { kind: 'attrs', attrs: { [`key_${id.slice(-2)}`]: { v: 1, src: ['doc_5e7730'] } } },
  src: ['doc_5e7730'],
  names: [],
  priorValue: null,
  confidence,
  dissent,
  authorRole: 'gabriel_agent',
  status: 'pending',
  createdAt: '2026-08-03T09:12:00Z',
  decidedAt: null,
  decidedBy: null,
});

const LOW_AGREED = actOf('bb000001-0000-4000-8000-000000000001', 0.4, false);
const LOW_DISSENT = actOf('bb000001-0000-4000-8000-000000000002', 0.4, true);
const HIGH_DISSENT = actOf('bb000001-0000-4000-8000-000000000003', 0.9, true);
const HIGH_AGREED = actOf('bb000001-0000-4000-8000-000000000004', 0.9, false);
const AT_THRESHOLD = actOf('bb000001-0000-4000-8000-000000000005', THRESHOLD, false);
const SILENT_AGREED = actOf('bb000001-0000-4000-8000-000000000006', null, false);
const SILENT_DISSENT = actOf('bb000001-0000-4000-8000-000000000007', null, true);

const READ: Corpus = {
  ...corpus,
  proposals: [
    LOW_AGREED,
    LOW_DISSENT,
    HIGH_DISSENT,
    HIGH_AGREED,
    AT_THRESHOLD,
    SILENT_AGREED,
    SILENT_DISSENT,
  ],
};

function changeIn(threshold: number | null, act: Proposal): Change {
  const found = readQueue(READ, threshold)
    .flatMap((subject) => subject.changes)
    .find((change) => change.id === act.id);
  if (found === undefined) throw new Error(`the queue holds no act ${act.id}`);
  return found;
}

describe('why an act stands in the queue, with a threshold in force', () => {
  it('sends a low confidence with no disagreement on the confidence alone', () => {
    expect(changeIn(THRESHOLD, LOW_AGREED).routing).toBe('low-confidence');
  });

  it('names both conditions when the agents disagreed and the confidence is low', () => {
    expect(changeIn(THRESHOLD, LOW_DISSENT).routing).toBe('both');
  });

  it('names the disagreement alone when the confidence is high', () => {
    expect(changeIn(THRESHOLD, HIGH_DISSENT).routing).toBe('dissent');
  });

  it('names neither condition when the agents agreed and the confidence is high', () => {
    expect(changeIn(THRESHOLD, HIGH_AGREED).routing).toBe('neither');
  });

  it('reads a confidence equal to the threshold as not under it', () => {
    expect(changeIn(THRESHOLD, AT_THRESHOLD).routing).toBe('neither');
  });

  it('names the disagreement of an act that states no confidence', () => {
    expect(changeIn(THRESHOLD, SILENT_DISSENT).routing).toBe('dissent');
  });

  it('never says the screen holds no threshold when the act alone states no confidence', () => {
    const change = changeIn(THRESHOLD, SILENT_AGREED);
    expect(change.routing).toBe('unstated');
    expect(change.routingWords).not.toMatch(/holds no threshold/i);
    expect(change.routingWords).toMatch(/confidence/i);
  });
});

describe('why an act stands in the queue, with no threshold in force', () => {
  it('names the disagreement, and states no reason for an act the agents agreed on', () => {
    expect(changeIn(null, HIGH_DISSENT).routing).toBe('dissent');
    expect(changeIn(null, LOW_AGREED).routing).toBe('unstated');
    expect(changeIn(null, LOW_AGREED).routingWords).toMatch(/threshold/i);
  });
});
