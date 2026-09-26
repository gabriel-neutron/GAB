import { describe, expect, it } from 'vitest';

import type { DocumentRow } from '@/shared/read/model';

import { searchByDocument } from './document-search';

const document = (id: string, title: string, uri: string | null): DocumentRow => ({
  id,
  kind: 'report',
  title,
  uri,
  archiveUri: null,
  sha256: null,
  retrievedAt: null,
  admiralty: null,
  admiraltyOrigin: null,
});

const CORPUS: readonly DocumentRow[] = [
  document(
    'doc_1',
    'Port of Rotterdam — bulk cargo throughput, Q2 2026',
    'https://example.invalid/a',
  ),
  document(
    'doc_2',
    'Corporate registry extract — Meridian Bulk Carriers Ltd',
    'https://example.invalid/b',
  ),
  document('doc_3', 'Direct entry by the analyst', null),
];

describe('a search by document title', () => {
  it('asks for a query when the field holds only blanks', () => {
    expect(searchByDocument(CORPUS, '   ')).toEqual({ kind: 'no-query' });
  });

  it('finds a title with no regard to case or accents', () => {
    const answer = searchByDocument(CORPUS, 'ROTTERDAM');
    expect(answer.kind === 'matches' ? answer.hits.map((hit) => hit.documentId) : []).toEqual([
      'doc_1',
    ]);
  });

  it('carries the address through so a hit can open it, and null when there is none', () => {
    const answer = searchByDocument(CORPUS, 'analyst');
    expect(answer).toEqual({
      kind: 'matches',
      query: 'analyst',
      hits: [
        { documentId: 'doc_3', title: 'Direct entry by the analyst', kind: 'report', uri: null },
      ],
    });
  });

  it('puts a title that starts with the query before a title that only holds it', () => {
    const answer = searchByDocument(CORPUS, 'corporate');
    expect(answer.kind === 'matches' ? answer.hits.map((hit) => hit.documentId) : []).toEqual([
      'doc_2',
    ]);
  });

  it('states the query it did not find', () => {
    expect(searchByDocument(CORPUS, 'zzqx')).toEqual({ kind: 'no-match', query: 'zzqx' });
  });
});
