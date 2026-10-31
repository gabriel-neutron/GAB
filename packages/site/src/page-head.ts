import type { SiteManifest } from '@gab/release/site-manifest';

export const escapeHtml = (text: string): string =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');

const LICENCE = 'https://creativecommons.org/licenses/by/4.0/';
const SITE_NAME = 'GAB dataset';
const IMAGE = { file: 'og-image.png', width: 1200, height: 630 } as const;
const IMAGE_TEXT = 'GAB dataset: entities, relations and claims, each with its documents.';

const FORMATS: Readonly<Record<string, string>> = {
  csv: 'text/csv',
  json: 'application/json',
  jsonld: 'application/ld+json',
  geojson: 'application/geo+json',
  md: 'text/markdown',
};

const formatOf = (path: string): string =>
  FORMATS[path.slice(path.lastIndexOf('.') + 1)] ?? 'application/octet-stream';

const contactPoint = (name: string, address: string): Record<string, string> =>
  address.startsWith('mailto:')
    ? { '@type': 'ContactPoint', contactType: name, email: address.slice('mailto:'.length) }
    : { '@type': 'ContactPoint', contactType: name, url: address };

/** The structured data of the site: a schema.org `Dataset` with the licence, the date, the files
 * of the release and its contact addresses. */
export const datasetOf = (manifest: SiteManifest, site: string): Record<string, unknown> => ({
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  '@id': `${site}#dataset`,
  name: SITE_NAME,
  description:
    'Entities, relations and claims, each with a label that tells who decided it and the documents that state it.',
  url: site,
  version: manifest.version,
  datePublished: manifest.date,
  dateModified: manifest.date,
  license: LICENCE,
  isAccessibleForFree: true,
  distribution: manifest.files.map((file) => ({
    '@type': 'DataDownload',
    name: file.path,
    contentUrl: `${site}release/${file.path}`,
    encodingFormat: formatOf(file.path),
    description: `SHA-256 checksum: ${file.sha256}`,
  })),
  publisher: {
    '@type': 'Organization',
    name: SITE_NAME,
    contactPoint: [
      contactPoint('Report an error', manifest.contacts.reportError),
      contactPoint('Right of reply', manifest.contacts.rightOfReply),
    ],
  },
});

export interface PageHead {
  readonly title: string;
  readonly description: string;
  /** The absolute address of the site, which ends with a slash. Null: no absolute address. */
  readonly site: string | null;
  /** The folder of the page from the root of the site. */
  readonly folder: string;
  /** The page must not be in a search result. */
  readonly noindex: boolean;
  /** The structured data of the page, or none. */
  readonly structured: readonly Record<string, unknown>[];
}

/** The address of the page, absolute, with a slash at its end. */
export const canonicalOf = (site: string, folder: string): string =>
  folder === '' ? site : `${site}${folder}/`;

// A `<` in a JSON text could close the script element, so it is written as an escape.
const scriptJson = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c');

/** The tags of the head of one page, as HTML text. The page needs no script to give them. */
export const pageHead = (head: PageHead): string => {
  const title = escapeHtml(head.title);
  const description = escapeHtml(head.description);
  const tags = [`<meta name="description" content="${description}" />`];
  if (head.noindex) tags.push('<meta name="robots" content="noindex, follow" />');
  // A page that is not in a search result has no canonical address and no preview tags.
  if (head.site !== null && !head.noindex) {
    const address = escapeHtml(canonicalOf(head.site, head.folder));
    const image = escapeHtml(`${head.site}${IMAGE.file}`);
    tags.push(
      `<link rel="canonical" href="${address}" />`,
      '<meta property="og:type" content="website" />',
      `<meta property="og:site_name" content="${SITE_NAME}" />`,
      `<meta property="og:title" content="${title}" />`,
      `<meta property="og:description" content="${description}" />`,
      `<meta property="og:url" content="${address}" />`,
      `<meta property="og:image" content="${image}" />`,
      `<meta property="og:image:width" content="${String(IMAGE.width)}" />`,
      `<meta property="og:image:height" content="${String(IMAGE.height)}" />`,
      `<meta property="og:image:alt" content="${escapeHtml(IMAGE_TEXT)}" />`,
      '<meta name="twitter:card" content="summary_large_image" />',
      `<meta name="twitter:title" content="${title}" />`,
      `<meta name="twitter:description" content="${description}" />`,
      `<meta name="twitter:image" content="${image}" />`,
    );
  }
  for (const one of head.structured)
    tags.push(`<script type="application/ld+json">${scriptJson(one)}</script>`);
  return tags.join('');
};
