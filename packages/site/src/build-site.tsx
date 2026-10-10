import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { ClaimPage } from './claim-page.tsx';
import { claimText } from './claim-text.ts';
import { DownloadsPage } from './downloads-page.tsx';
import { EntityPage } from './entity-page.tsx';
import { HomePage } from './home-page.tsx';
import { FEATURES_ELEMENT } from './map-elements.ts';
import { MapPage } from './map-page.tsx';
import { MethodPage } from './method-page.tsx';
import { RedirectPage } from './redirect-page.tsx';
import { SiteDocument } from './site-document.tsx';
import {
  claimPage,
  DOWNLOADS,
  entityPage,
  HOME,
  hrefFrom,
  MAP,
  MAP_SCRIPT,
  MAP_STYLE,
  METHOD,
  relationPage,
  STYLE,
  V1,
  type SitePath,
} from './site-paths.ts';
import { readSiteRelease } from './site-release.ts';

/** One file of the site: its path from the root of the site and its text. */
export interface SiteFile {
  readonly path: SitePath;
  readonly text: string;
}

const html = (
  path: SitePath,
  title: string,
  page: ReactElement,
  head: { readonly redirect?: SitePath; readonly stylesheets?: readonly SitePath[] } = {},
): SiteFile => ({
  path,
  text: `<!doctype html>\n${renderToStaticMarkup(
    <SiteDocument
      page={{ path, title }}
      redirect={head.redirect ?? null}
      stylesheets={head.stylesheets ?? []}
    >
      {page}
    </SiteDocument>,
  )}\n`,
});

// External constraint: a JSON text inside a script element ends the element at the first `</`,
// and a label comes from an untrusted page.
const scriptSafe = (json: string): string => json.replaceAll('<', '\\u003c');

/** The static site of one release, from the files of its folder: the pages and the stylesheet.
 * The site also needs a copy of each file of the release at its root. `style` is the stylesheet of the site. With
 * `withV1` false, the address of the old site gives a page that says that this copy holds none.
 * The map page needs the map script and MapLibre in its assets folder. */
export const buildSite = (
  files: ReadonlyMap<string, string>,
  style: string,
  withV1: boolean,
): readonly SiteFile[] => {
  const release = readSiteRelease(files);
  const pages: SiteFile[] = [
    html(HOME, 'Critical nodes', <HomePage release={release} />),
    html(
      MAP,
      'Map',
      <>
        <MapPage release={release} />
        <script
          type="application/json"
          id={FEATURES_ELEMENT}
          dangerouslySetInnerHTML={{ __html: scriptSafe(release.geojson.trim()) }}
        />
        <script type="module" src={hrefFrom(MAP, MAP_SCRIPT)} />
      </>,
      { stylesheets: [MAP_STYLE] },
    ),
    html(DOWNLOADS, 'Downloads', <DownloadsPage release={release} />),
    html(METHOD, 'Method', <MethodPage release={release} />),
  ];
  for (const entity of release.entities)
    pages.push(
      html(
        entityPage(entity.id),
        entity.label,
        <EntityPage release={release} entityId={entity.id} />,
      ),
    );
  for (const claim of release.claims)
    pages.push(
      html(
        claimPage(claim.id),
        claimText(claim),
        <ClaimPage release={release} claimId={claim.id} />,
      ),
    );
  for (const [absorbed, survivor] of release.aliases) {
    const target = release.entityById.get(survivor);
    if (target === undefined || release.entityById.has(absorbed)) continue;
    const page = { path: entityPage(absorbed), title: 'Merged entity' };
    pages.push(
      html(
        page.path,
        page.title,
        <RedirectPage
          release={release}
          page={page}
          target={{ path: entityPage(survivor), words: target.label }}
          reason="A merge joined this entity to another entity, which now holds its claims:"
        />,
        { redirect: entityPage(survivor) },
      ),
    );
  }
  for (const relation of release.relations) {
    if (!release.claimById.has(relation.id)) continue;
    const page = { path: relationPage(relation.id), title: 'Relation' };
    pages.push(
      html(
        page.path,
        page.title,
        <RedirectPage
          release={release}
          page={page}
          target={{ path: claimPage(relation.id), words: 'the claim of this relation' }}
          reason="A relation has its page at its claim:"
        />,
        { redirect: claimPage(relation.id) },
      ),
    );
  }
  if (!withV1) {
    const page = { path: V1, title: 'Version 1' };
    pages.push(
      html(
        V1,
        page.title,
        <RedirectPage
          release={release}
          page={page}
          target={{ path: HOME, words: 'Open the critical nodes.' }}
          reason="This copy of the site holds no build of the version 1 map."
        />,
      ),
    );
  }
  return [...pages, { path: STYLE, text: style }];
};
