import type { DocId, DocumentKind, DocumentRow, DocumentType } from '@/shared/read/model';

import { folded } from '@/shared/text-fold';

export interface DocumentHit {
  readonly documentId: DocId;
  readonly title: string;
  readonly kind: DocumentKind;
  readonly type: string;
  /** The host of the address, with no "www.", or null when the document has no address. */
  readonly host: string | null;
  readonly uri: string | null;
}

const TYPE_WORDS: Readonly<Record<DocumentType, string>> = {
  legal_act: 'Legal act',
  register_entry: 'Register entry',
  press_release: 'Press release',
  report: 'Report',
  telegram_post: 'Telegram post',
  ngo_publication: 'NGO publication',
  news_article: 'News article',
  other: 'Other',
};

// The same rule as hostOf in packages/tools/src/document-type.ts. The interface does not import
// @gab/tools, which holds the server tools, so each side holds a copy.
const hostOf = (uri: string | null): string | null => {
  const host = uri === null ? null : (URL.parse(uri)?.hostname ?? null);
  return host === null || host === '' ? null : host.replace(/^www\./u, '');
};

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
      type: TYPE_WORDS[document.docType],
      host: hostOf(document.uri),
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
