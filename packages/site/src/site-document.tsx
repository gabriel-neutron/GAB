import type { ReactNode } from 'react';

import { hrefFrom, STYLE, type SitePath } from './site-paths.ts';

export interface SiteDocumentProps {
  readonly path: SitePath;
  readonly title: string;
  /** The page that the browser opens in place of this one, or null. */
  readonly redirect: SitePath | null;
  readonly children: ReactNode;
}

/** The HTML document of one page of the site, with the stylesheet of the site at its relative
 * address. */
export function SiteDocument({ path, title, redirect, children }: SiteDocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${title} · GAB dataset`}</title>
        <link rel="stylesheet" href={hrefFrom(path, STYLE)} />
        {redirect === null ? null : (
          <meta httpEquiv="refresh" content={`0; url=${hrefFrom(path, redirect)}`} />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
