// The render of one page at the release (ADR 0028). The release command loads this file through
// Vite, in Node, and asks it for the HTML of each page that has a permanent address. The browser
// never loads it. The caller installs a `fetch` that answers the files of the release and nothing
// else, so the read service looks down and each page reads the release, as the built site does.

import { createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { renderToString } from 'react-dom/server';

import { SiteReleaseFault } from '@gab/release/site-release-fault';

import { createAppRouter } from './app-router';

export interface RenderedPage {
  /** The markup that goes inside the root element of the application. */
  readonly html: string;
  /** The title of the document. */
  readonly title: string;
}

const isPreloadable = (value: unknown): value is { preload: () => Promise<unknown> } =>
  typeof value === 'function' && 'preload' in value && typeof value.preload === 'function';

const preload = async (value: unknown): Promise<void> => {
  if (isPreloadable(value)) await value.preload();
};

/** Renders the page at `address`, a path that starts with `/` and has no base. The router loads
 * the data of the page first, so the markup holds the real text and not a loading notice. */
export async function renderPage(address: string): Promise<RenderedPage> {
  const base = import.meta.env.BASE_URL.replace(/\/+$/u, '');
  const router = createAppRouter(createMemoryHistory({ initialEntries: [`${base}${address}`] }));
  await router.load();
  // A page that is not found, or that failed, is never a good page of the site.
  const failed = router.state.matches.some(
    (match) => match.status === 'notFound' || match.status === 'error',
  );
  if (failed || router.state.matches.length === 0)
    throw new SiteReleaseFault(
      `The page ${address} is not found or has an error, and it has no permanent page.`,
    );
  // External constraint: the router loads the data of a route on the server and not its code, and
  // `renderToString` does not wait for code. A page would then hold its loading notice in place of
  // its text.
  for (const match of router.state.matches) {
    const { options } = router.routesById[match.routeId];
    await Promise.all(
      [options.component, options.notFoundComponent, options.errorComponent].map(preload),
    );
  }
  // The deepest route that sets a title wins, as in the browser.
  let title = 'GAB dataset';
  for (const match of router.state.matches)
    for (const tag of match.meta ?? []) if (typeof tag?.title === 'string') title = tag.title;
  const html = renderToString(<RouterProvider router={router} />);
  // A boundary that waits for something gives its notice in place of its text.
  if (html.includes('<!--$?-->') || html.includes('<!--$!-->'))
    throw new Error(`The page ${address} did not render in full.`);
  // `HeadContent` writes the title where it stands, and the document has its own title element.
  return { html: html.replace(/<title>[^<]*<\/title>/u, ''), title };
}
