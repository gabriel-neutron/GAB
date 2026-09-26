import type { DocId, DocumentKind, DocumentRow } from '@/shared/read/model';

import { folded } from './text-fold';

export interface DocumentHit {
  readonly documentId: DocId;
  readonly title: string;
  readonly kind: DocumentKind;
  readonly uri: string | null;
}

export type DocumentSearchAnswer =
  | { readonly kind: 'no-query' }
  | { readonly kind: 'no-match'; readonly query: string }
  | { readonly kind: 'matches'; readonly query: string; readonly hits: readonly DocumentHit[] };

const byTitle = (a: DocumentHit, b: DocumentHit): number =>
  a.title.localeCompare(b.title) || a.documentId.localeCompare(b.documentId);

export function searchByDocument(
  documents: readonly DocumentRow[],
  query: string,
): DocumentSearchAnswer {
  const asked = folded(query);
  if (asked === '') return { kind: 'no-query' };

  const starts: DocumentHit[] = [];
  const holds: DocumentHit[] = [];
  for (const document of documents) {
    const at = folded(document.title).indexOf(asked);
    if (at === -1) continue;
    const hit = {
      documentId: document.id,
      title: document.title,
      kind: document.kind,
      uri: document.uri,
    };
    (at === 0 ? starts : holds).push(hit);
  }

  const hits = [...starts.sort(byTitle), ...holds.sort(byTitle)];
  const said = query.trim();
  return hits.length === 0
    ? { kind: 'no-match', query: said }
    : { kind: 'matches', query: said, hits };
}
