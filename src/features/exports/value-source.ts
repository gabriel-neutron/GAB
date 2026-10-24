import type { SiteRelease } from '@gab/release/site-release';

import { safeHref } from '@gab/release/safe-href';

import type { FigureRow } from './figure-rows';

/** Where a value is read: the words of the link, and its target. A target is null when the
 * document has no public address, and the words then stay as text. */
export interface ValueSource {
  readonly words: string;
  readonly href: string | null;
}

/** The title and the address of each public document of the release, by document identifier. */
export const documentsOf = (release: SiteRelease | null): ReadonlyMap<string, ValueSource> => {
  const documents = new Map<string, ValueSource>();
  for (const claim of release?.claims ?? [])
    for (const source of claim.sources)
      if (!documents.has(source.documentId))
        documents.set(source.documentId, {
          words: source.title,
          href: source.address === null ? null : safeHref(source.address),
        });
  return documents;
};

/** The document of one value: the one of the release when its identifier is there, else the
 * address that the file gives, else the text of the file. */
export const documentOf = (
  row: FigureRow,
  documents: ReadonlyMap<string, ValueSource>,
): ValueSource =>
  documents.get(row.document) ?? { words: row.document, href: safeHref(row.document) };

/** The source of one value: its document, then the page and the cell where the value stands.
 * The three functions are one job, the source of a value: the lookup, the document, and the place. */
export function sourceOf(row: FigureRow, documents: ReadonlyMap<string, ValueSource>): ValueSource {
  const base = documentOf(row, documents);
  const place = [row.page === '' ? '' : `p. ${row.page}`, row.excerpt].filter((one) => one !== '');
  return {
    words: place.length === 0 ? base.words : `${base.words}, ${place.join(', ')}`,
    href: base.href,
  };
}
