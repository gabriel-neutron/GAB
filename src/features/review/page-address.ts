import type { SourceDocument } from './unit-page';

/** The address that opens a document at one page. External constraint: a browser opens a PDF at a
 * page from the fragment `#page=`, and no other format has such a fragment. A document with no
 * address, such as a file of the operator, has no link. */
export function pageAddress(document: SourceDocument, page: number): string | null {
  if (document.uri === null) return null;
  return document.mime === 'application/pdf'
    ? `${document.uri}#page=${String(page)}`
    : document.uri;
}
