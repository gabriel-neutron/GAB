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
);

// The graph writes its selection with `history.replaceState`, which the router never sees, so
// the selection is read from the address bar. The router calls each function again at the click.
// shortcut: the `href` of the graph is computed at render and can name an older selection, which
// a click with a modifier opens; read the selection from a store of the graph when one exists.
// The map holds the entity only: a relation of the graph is not carried to it.
const TO_MAP = () => ({
  entity: carriedSelection(window.location.pathname, window.location.search, '/map').entity,
});
const TO_GRAPH = () => carriedSelection(window.location.pathname, window.location.search, '/graph');

/** The one header of the site: the name of the dataset, one navigation with every page, and the
 * controls of the screen. A page that writes is in the navigation only when the writer answers.
 * A page that names one record (an entity, a claim) is reached from the page that draws it. */
export function SiteHeader({ writerOnline, filter, actions }: SiteHeaderProps) {
  // The map writes its selection through the router. A link keeps the `href` of its first render,
  // so each new address of the router builds the two links again, and each one names the
  // selection of that moment. The graph writes past the router, and its click reads the address.
  const address = useLocation({ select: (location) => location.searchStr });
  return (
    <header className="flex shrink-0 flex-wrap items-stretch gap-x-3 border-b border-border px-2 sm:flex-nowrap">
      {/* A narrow screen gives the navigation a row of its own, under the name and the controls. */}
      <div className="flex h-10 flex-1 items-stretch sm:flex-none">
        <Link
          to="/"
          className="inline-flex items-center px-1 text-body/5 font-semibold tracking-tight outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
        >
          GAB dataset
        </Link>
      </div>
      {/* A navigation wider than the screen scrolls in its own row, and never the page. */}
      <nav
        aria-label="Pages of the site"
        className="order-1 -mx-2 flex h-9 basis-full items-stretch overflow-x-auto border-t border-border px-1 sm:order-none sm:mx-0 sm:mr-auto sm:h-10 sm:basis-auto sm:border-t-0 sm:px-0"
      >
        <Link to="/" activeOptions={{ exact: true }} className={PAGE_LINK}>
          Critical nodes
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
        <Link to="/search" className={PAGE_LINK}>
          Search
        </Link>
        <Link to="/downloads" className={PAGE_LINK}>
          Downloads
        </Link>
        {writerOnline ? (
          <Link
            to="/review"
            search={{ unit: '', view: 'queue', group: '' }}
            activeOptions={{ includeSearch: false }}
            className={PAGE_LINK}
          >
            Review
          </Link>
        ) : null}
      </nav>
      {filter === null ? null : (
        <div className="order-2 flex basis-full items-center pb-2 sm:order-none sm:basis-auto sm:pb-0">
          {filter}
        </div>
      )}
      <div className="flex h-10 shrink-0 items-center gap-2">{actions}</div>
    </header>
  );
}
