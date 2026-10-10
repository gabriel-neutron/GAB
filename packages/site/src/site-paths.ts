import { SiteReleaseFault } from './site-release-fault.ts';

/** A file of the site, by its path from the root of the site, with `/` between the folders. */
export type SitePath = string;

export const HOME: SitePath = 'index.html';
export const MAP: SitePath = 'map/index.html';
export const DOWNLOADS: SitePath = 'downloads/index.html';
export const METHOD: SitePath = 'method/index.html';
export const V1: SitePath = 'v1/index.html';
export const STYLE: SitePath = 'assets/site.css';

/** An identifier of the release cannot be a path of the site. */
export class SitePathFault extends SiteReleaseFault {}

// A segment of a path is safe on each file system and in an address with no encoding, and it is
// not the name of the index file of a page.
const SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/u;
const INDEX = 'index.html';

const segmentsOf = (id: string): readonly string[] => {
  const segments = id.split('/');
  if (segments.some((one) => !SEGMENT.test(one) || one === INDEX))
    throw new SitePathFault(`The identifier "${id}" cannot be an address of the site.`);
  return segments;
};

// The pages of an entity, a relation and a claim are at the paths of their identifiers in the
// JSON-LD file, under its base, so an identifier opens its page when the site is at the base. A
// page is a folder with an index file, because a file address cannot open a folder.
const pageOf =
  (kind: string) =>
  (id: string): SitePath =>
    `${kind}/${segmentsOf(id).join('/')}/${INDEX}`;

export const entityPage = pageOf('entity');
export const relationPage = pageOf('relation');
export const claimPage = pageOf('claim');

/** The identifier of an entity or a claim in the JSON-LD file: its path under the base. */
export const permanentAddress = (base: string, kind: 'entity' | 'claim', id: string): string =>
  `${base}${kind}/${segmentsOf(id).map(encodeURIComponent).join('/')}`;

/** The relative address of `target` from the page `here`, so the site works under any base path
 * and from the files on a disk. */
export const hrefFrom = (here: SitePath, target: SitePath): string =>
  '../'.repeat(here.split('/').length - 1) + target.split('/').map(encodeURIComponent).join('/');

/** The map script and the stylesheet of MapLibre, beside the stylesheet of the site. */
export const MAP_SCRIPT: SitePath = 'assets/map.js';
export const MAP_STYLE: SitePath = 'assets/maplibre-gl.css';
