import { SiteFrame } from './site-frame.tsx';
import { hrefFrom, type SitePath } from './site-paths.ts';
import type { SiteRelease } from './site-release.ts';
import { LINK } from './site-style.ts';

export interface RedirectPageProps {
  readonly release: SiteRelease;
  /** The address that a reader opened, and the page that it now gives. */
  readonly page: { readonly path: SitePath; readonly title: string };
  readonly target: { readonly path: SitePath; readonly words: string };
  readonly reason: string;
}

/** A page at an old or an alternative address: it says why and links the page that holds the
 * content. The document of the page also sends the browser there. */
export function RedirectPage({ release, page, target, reason }: RedirectPageProps) {
  return (
    <SiteFrame release={release} page={page}>
      <p>
        {reason}{' '}
        <a className={LINK} href={hrefFrom(page.path, target.path)}>
          {target.words}
        </a>
      </p>
    </SiteFrame>
  );
}
