import type { ReactNode } from 'react';

import { releaseDay } from './release-day.ts';
import { LINK } from './site-style.ts';
import { DOWNLOADS, HOME, hrefFrom, MAP, METHOD, V1, type SitePath } from './site-paths.ts';
import type { SiteRelease } from './site-release.ts';

export interface SiteFrameProps {
  readonly release: SiteRelease;
  /** The path of the page in the site, and its title. */
  readonly page: { readonly path: SitePath; readonly title: string };
  readonly children: ReactNode;
}

const NAV: readonly { readonly path: SitePath; readonly words: string }[] = [
  { path: HOME, words: 'Critical nodes' },
  { path: MAP, words: 'Map' },
  { path: DOWNLOADS, words: 'Downloads' },
  { path: METHOD, words: 'Method' },
  { path: V1, words: 'Version 1 (ORBAT)' },
];

/** The frame of each page of the site: the version and the day of the release, the links to the
 * other pages, and the two contact links of the release. */
export function SiteFrame({ release, page, children }: SiteFrameProps) {
  const { manifest } = release;
  // Departure: the site is a reading surface, not a working screen, so its prose is 14px and it
  // has two heading sizes. The tables keep the dense scale of the theme.
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 pt-3 pb-4 text-sm/6 [&_section>h2]:text-base [&_section>h2]:font-semibold">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-border pb-3">
        <a className={`font-semibold tracking-tight ${LINK}`} href={hrefFrom(page.path, HOME)}>
          GAB dataset
        </a>
        <p className="text-label">
          Version of {releaseDay(manifest.date)}{' '}
          <span className="font-mono">({manifest.version})</span>
        </p>
        <nav aria-label="Pages of the site" className="w-full sm:ml-auto sm:w-auto">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {NAV.map((one) => (
              <li key={one.path}>
                <a
                  className={`${LINK} text-muted-foreground hover:text-foreground aria-[current=page]:font-medium aria-[current=page]:text-foreground aria-[current=page]:decoration-primary`}
                  href={hrefFrom(page.path, one.path)}
                  aria-current={one.path === page.path ? 'page' : undefined}
                >
                  {one.words}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main className="flex flex-col gap-6">
        <h1 className="text-xl/7 font-semibold tracking-tight">{page.title}</h1>
        {children}
      </main>
      <footer className="mt-auto flex flex-wrap gap-x-4 gap-y-1 border-t border-border pt-3 text-xs/5 text-label">
        <a className={LINK} href={manifest.contacts.reportError}>
          Report an error
        </a>
        <a className={LINK} href={manifest.contacts.rightOfReply}>
          Right of reply
        </a>
        <p>The dataset is under CC-BY 4.0. Each row gives its own licence.</p>
      </footer>
    </div>
  );
}
