import { expect, test } from 'vitest';

import { gazetteOnlyDesignations } from './gazette-only-designations.ts';
import type { ReleaseDocument, ReleaseRecord, ReleaseRelation } from './release-record.ts';

const doc = (id: string, uri: string): [string, ReleaseDocument] => [
  id,
  { id, title: id, uri, retrieved_at: null, licence: null, provider: null },
];

const relation = (n: number, type: string, sources: string[]): ReleaseRelation => ({
  id: `00000000-0000-4000-8000-00000000000${String(n)}`,
  type,
  src_id: '00000000-0000-4000-8000-0000000000a1',
  dst_id: '00000000-0000-4000-8000-0000000000a2',
  valid_from: null,
  valid_to: null,
  origin_label: 'Proposed — not checked',
  sources,
});

const recordOf = (relations: ReleaseRelation[]): ReleaseRecord =>
  ({
    relations,
    documents: new Map([
      doc('fr', 'https://www.federalregister.gov/d/2024-1'),
      doc('gov', 'https://www.govinfo.gov/content/pkg/x'),
      doc('cg', 'https://gazette.gc.ca/rp-pr/p2/2024/x.html'),
      doc('sdn', 'https://sanctionslistservice.ofac.treas.gov/x'),
    ]),
  }) as unknown as ReleaseRecord;

test('a designation that cites only the Federal Register is listed', () => {
  const one = relation(1, 'designated_by', ['fr']);
  const two = relation(2, 'restricted_by', ['gov', 'cg']);
  expect(gazetteOnlyDesignations(recordOf([one, two]))).toStrictEqual([one.id, two.id]);
});

test('a designation with an SDN line besides the Federal Register is not listed', () => {
  expect(
    gazetteOnlyDesignations(recordOf([relation(1, 'designated_by', ['fr', 'sdn'])])),
  ).toStrictEqual([]);
});

test('a relation with no such source, or of another type, is not listed', () => {
  expect(
    gazetteOnlyDesignations(
      recordOf([relation(1, 'designated_by', ['sdn']), relation(2, 'owns', ['fr'])]),
    ),
  ).toStrictEqual([]);
});
