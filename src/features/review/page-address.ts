import { safeHref } from '@gab/release/safe-href';

import type { SourceDocument } from './unit-page';

/** The address that opens a document at one page. External constraint: a browser opens a PDF at a
 * page from the fragment `#page=`, and no other format has such a fragment. A document with no
 * address, such as a file of the operator, has no link. An address that is not a web address stays
 * text, as everywhere. */
export function pageAddress(document: SourceDocument, page: number): string | null {
  const address = document.uri === null ? null : safeHref(document.uri);
  if (address === null) return null;
  return document.mime === 'application/pdf' ? `${address}#page=${String(page)}` : address;
}
