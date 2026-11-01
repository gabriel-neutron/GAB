import { Link, useLocation } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { carriedSelection } from '@/shared/carried-selection';
import { cn } from '@/shared/lib/utils';

export interface SiteHeaderProps {
  /** True only when the write service answered. Each page that writes is hidden otherwise. */
  readonly writerOnline: boolean;
  /** The filter of a screen that reads one. It takes a row of its own on a narrow screen. */
  readonly filter: ReactNode;
  /** The controls at the end of the header: a creation, the theme. */
  readonly actions: ReactNode;
}

// The state of a link is drawn from the `data-status` the router writes, and never from an
// `activeProps` class list: two colour utilities in one list are resolved by the order of the
// stylesheet, and a variant is resolved by the cascade, which is the order this file states.
const PAGE_LINK = cn(
  'inline-flex h-8 shrink-0 items-center self-center rounded-sm px-3 text-body-sm',
  'text-muted-foreground transition-colors duration-150 outline-none hover:text-foreground',
  'focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring',
  'data-[status=active]:bg-surface-secondary data-[status=active]:text-foreground',
  'data-[section-active=true]:bg-surface-secondary data-[section-active=true]:text-foreground',
);

// The graph writes its selection with `history.replaceState`, which the router never sees, so
// the selection is read from the address bar. The router calls each function again at the click.
// shortcut: the `href` of the graph is computed at render and can name an older selection, which
// a click with a modifier opens; read the selection from a store of the graph when one exists.
// The render at the release has no address bar, and no selection is carried there.
const addressBar = (): { readonly pathname: string; readonly search: string } =>
  typeof window === 'undefined' ? { pathname: '', search: '' } : window.location;
const TO_MAP = () => carriedSelection(addressBar().pathname, addressBar().search, '/map');
const ABOUT = ['/method', '/glossary', '/help'];
const DATA = ['/search', '/downloads', '/entity/', '/relation/', '/claim/'];
const REPOSITORY = 'https://github.com/gabriel-neutron/GAB';
const TO_GRAPH = () => carriedSelection(addressBar().pathname, addressBar().search, '/graph');

/** The one header of the site: the name of the dataset, one navigation with every page, and the
 * controls of the screen. A page that writes is in the navigation only when the writer answers.
 * A page that names one record (an entity, a claim) is reached from the page that draws it. */
export function SiteHeader({ writerOnline, filter, actions }: SiteHeaderProps) {
  // The map writes its selection through the router. A link keeps the `href` of its first render,
  // so each new address of the router builds the two links again, and each one names the
  // selection of that moment. The graph writes past the router, and its click reads the address.
  const address = useLocation({ select: (location) => location.searchStr });
  // A page of the release opens at its folder address, with an end slash; its render had none.
  const path = useLocation({ select: (location) => location.pathname.replace(/(.)\/$/u, '$1') });
  const section = ABOUT.includes(path)
    ? 'about'
    : DATA.some((prefix) => path.startsWith(prefix))
      ? 'data'
      : path === '/map' || path === '/graph'
        ? 'none'
        : path === '/' || path === '/bibliography'
          ? 'report'
          : 'none';
  return (
    <header className="site-navigation-main">
      <Link to="/" aria-label="GAB dataset" className="site-wordmark">
        GAB
      </Link>
      <nav aria-label="Pages of the site" className="site-primary-links">
        <Link
          to="/"
          activeOptions={{ exact: true }}
          data-section-active={section === 'report'}
          className={PAGE_LINK}
        >
          Report
        </Link>
        <Link
          key={`map${address}`}
          to="/map"
          search={TO_MAP}
          activeOptions={{ includeSearch: false }}
          className={PAGE_LINK}
        >
          Map
        </Link>
        <Link
          key={`graph${address}`}
          to="/graph"
          search={TO_GRAPH}
          activeOptions={{ includeSearch: false }}
          className={PAGE_LINK}
        >
          Graph
        </Link>
        <Link to="/search" data-section-active={section === 'data'} className={PAGE_LINK}>
          Data
        </Link>
        <Link to="/method" data-section-active={section === 'about'} className={PAGE_LINK}>
          About
        </Link>
        <a href={REPOSITORY} aria-label="Source code on GitHub" className={PAGE_LINK}>
          {/* The GitHub mark: the icon set has no brand marks. */}
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 fill-current">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
      </nav>
      <div className="site-navigation-actions">
        {filter === null ? null : <div className="site-context-filter">{filter}</div>}
        {writerOnline ? (
          <Link to="/review" search={{ unit: '', view: 'queue', group: '' }} className={PAGE_LINK}>
            Review
          </Link>
        ) : null}
        {actions}
      </div>
    </header>
  );
}
