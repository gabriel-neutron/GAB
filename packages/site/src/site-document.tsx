import type { ReactNode } from 'react';

import { hrefFrom, STYLE, type SitePath } from './site-paths.ts';

export interface SiteDocumentProps {
  readonly page: { readonly path: SitePath; readonly title: string };
  /** The page that the browser opens in place of this one, or null. */
  readonly redirect: SitePath | null;
  /** The stylesheets of the page after the stylesheet of the site. */
  readonly stylesheets: readonly SitePath[];
  readonly children: ReactNode;
}

// The icon is in the page, so the browser asks the host for no icon file. A square of the
// primary hue of the light theme, as hex because an icon reads no token.
const ICON =
  'data:image/svg+xml,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><rect width="16" height="16" fill="#0b6aa2"/><rect x="4" y="4" width="8" height="8" fill="#f5f7f9"/></svg>',
  );

/** The HTML document of one page of the site, with the stylesheets at their relative address. */
export function SiteDocument({ page, redirect, stylesheets, children }: SiteDocumentProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{`${page.title} · GAB dataset`}</title>
        <link rel="icon" href={ICON} />
        {[STYLE, ...stylesheets].map((one) => (
          <link key={one} rel="stylesheet" href={hrefFrom(page.path, one)} />
        ))}
        {redirect === null ? null : (
          <meta httpEquiv="refresh" content={`0; url=${hrefFrom(page.path, redirect)}`} />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
