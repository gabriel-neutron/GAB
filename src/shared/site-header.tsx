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
  'inline-flex h-full shrink-0 items-center border-b-2 border-transparent px-2 text-body/5',
  'text-muted-foreground transition-colors duration-100 outline-none hover:text-foreground',
  'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset',
  'data-[status=active]:border-primary data-[status=active]:text-foreground',
  'data-[section-active=true]:border-primary data-[section-active=true]:text-foreground',
);

// The graph writes its selection with `history.replaceState`, which the router never sees, so
// the selection is read from the address bar. The router calls each function again at the click.
// shortcut: the `href` of the graph is computed at render and can name an older selection, which
// a click with a modifier opens; read the selection from a store of the graph when one exists.
// The map holds the entity only: a relation of the graph is not carried to it.
// The render at the release has no address bar, and no selection is carried there.
const addressBar = (): { readonly pathname: string; readonly search: string } =>
  typeof window === 'undefined' ? { pathname: '', search: '' } : window.location;
const TO_MAP = () => ({
  entity: carriedSelection(addressBar().pathname, addressBar().search, '/map').entity,
  relation: '',
});
const ABOUT = ['/method', '/glossary', '/help'];
const DATA = ['/search', '/downloads', '/entity/', '/relation/', '/claim/'];
const TO_GRAPH = () => carriedSelection(addressBar().pathname, addressBar().search, '/graph');

/** The one header of the site: the name of the dataset, one navigation with every page, and the
 * controls of the screen. A page that writes is in the navigation only when the writer answers.
 * A page that names one record (an entity, a claim) is reached from the page that draws it. */
export function SiteHeader({ writerOnline, filter, actions }: SiteHeaderProps) {
  // The map writes its selection through the router. A link keeps the `href` of its first render,
  // so each new address of the router builds the two links again, and each one names the
  // selection of that moment. The graph writes past the router, and its click reads the address.
  const address = useLocation({ select: (location) => location.searchStr });
  const path = useLocation({ select: (location) => location.pathname });
  const section = ABOUT.includes(path)
    ? 'about'
    : DATA.some((prefix) => path.startsWith(prefix))
      ? 'data'
      : path === '/map' || path === '/graph'
        ? 'none'
        : 'report';
  return (
    <header className="site-navigation-main">
      <Link to="/" className="site-wordmark">
        GAB dataset
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
