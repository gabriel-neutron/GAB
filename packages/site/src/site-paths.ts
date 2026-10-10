/** A file of the site, by its path from the root of the site, with `/` between the folders. */
export type SitePath = string;

export const HOME: SitePath = 'index.html';
export const MAP: SitePath = 'map/index.html';
export const DOWNLOADS: SitePath = 'downloads/index.html';
export const METHOD: SitePath = 'method/index.html';
export const V1: SitePath = 'v1/index.html';
export const STYLE: SitePath = 'assets/site.css';

/** An identifier of the release cannot be a path of the site. */
export class SitePathFault extends Error {}

// The pages of an entity, a relation and a claim are at the paths of their identifiers in the
// JSON-LD file, under its base, so an identifier opens its page when the site is at the base. A
// page is a folder with an index file, because a file address cannot open a folder.
const pageOf =
  (kind: string) =>
  (id: string): SitePath => {
    const segments = id.split('/');
    if (segments.some((one) => one === '' || one === '.' || one === '..' || one.includes('\\')))
      throw new SitePathFault(`the identifier "${id}" cannot be a path of the site`);
    return `${kind}/${segments.join('/')}/index.html`;
  };

export const entityPage = pageOf('entity');
export const relationPage = pageOf('relation');
export const claimPage = pageOf('claim');

/** The relative address of `target` from the page `here`, so the site works under any base path
 * and from the files on a disk. */
export const hrefFrom = (here: SitePath, target: SitePath): string =>
  '../'.repeat(here.split('/').length - 1) + target.split('/').map(encodeURIComponent).join('/');

/** The map script and the stylesheet of MapLibre, beside the stylesheet of the site. */
export const MAP_SCRIPT: SitePath = 'assets/map.js';
export const MAP_STYLE: SitePath = 'assets/maplibre-gl.css';
