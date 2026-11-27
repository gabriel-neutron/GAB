import { expect, test } from 'vitest';

import { refuseSignedAddresses } from './release-record.ts';

test('a release stops when a document keeps a signed address, and the message names no token', () => {
  const run = () =>
    refuseSignedAddresses([
      { id: 'doc_000000000001', uri: 'https://example.org/a.csv' },
      { id: 'doc_000000000002', uri: 'https://bucket.example/a.csv?X-Amz-Signature=sekret' },
      { id: 'doc_000000000003', uri: null },
    ]);
  expect(run).toThrow(/doc_000000000002/u);
  expect(run).not.toThrow(/sekret|doc_000000000001|doc_000000000003/u);
});

test('a release with no signed address goes on', () => {
  expect(() =>
    refuseSignedAddresses([{ id: 'doc_000000000001', uri: 'https://example.org/a?Auth=AB' }]),
  ).not.toThrow();
});
