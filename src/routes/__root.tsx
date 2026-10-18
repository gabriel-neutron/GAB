import {
  createRootRoute,
  HeadContent,
  Link,
  Outlet,
  useLocation,
  useRouter,
} from '@tanstack/react-router';
import { CreateEntityDialog } from '@/features/edit/create-entity-dialog';
import { carriedSelection } from '@/shared/carried-selection';
import { cn } from '@/shared/lib/utils';
import { refreshCorpus } from '@/shared/read/corpus';
import { ModeToggle } from '@/shared/mode-toggle';
import { ScreenQueryField, ScreenQueryProvider } from '@/shared/screen-query';
import { ThemeProvider, useTheme } from '@/shared/theme-provider';
import { WhenWriterOnline } from '@/shared/write/when-writer-online';

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,

  // The router uses the deepest title a route sets. This one applies where no route sets one.
  head: () => ({ meta: [{ title: 'Gabriel' }] }),
});

// Departure: only these screens read the header filter. The search page has a field of its own,
// and a screen that reads no filter shows no field.
const FILTERED_SCREENS: ReadonlySet<string> = new Set(['/map', '/graph']);

function RootLayout() {
  const path = useLocation({ select: (location) => location.pathname });
  return (
    <ThemeProvider>
      {/* External constraint: `HeadContent` writes the `head` of a matched route into the
          document. Without it, a title is computed and never applied. */}
      <HeadContent />
      <ScreenQueryProvider path={path}>
        <div className="relative flex h-svh flex-col overflow-hidden">
          <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-2">
            <SurfaceNav />
            <div className="flex items-center gap-2">
              {FILTERED_SCREENS.has(path) ? <ScreenQueryField /> : null}
              <WhenWriterOnline>
                <NewEntityControl />
              </WhenWriterOnline>
              <ThemeControl />
            </div>
          </header>
          {/* External constraint: `min-h-0` lets this row hold a scroll of its own. Without it,
              the row grows to its content and pushes the window. */}
          <main className="min-h-0 flex-1">
            <Outlet />
          </main>
        </div>
      </ScreenQueryProvider>
    </ThemeProvider>
  );
}

// The state of a link is drawn from the `data-status` the router writes, and never from an
// `activeProps` class list: two colour utilities in one list are resolved by the order of the
// stylesheet, and a variant is resolved by the cascade, which is the order this file states.
const SURFACE_LINK = cn(
  'inline-flex h-full items-center border-b-2 border-transparent px-2 text-xs text-label',
  'outline-none hover:text-foreground focus-visible:border-ring focus-visible:ring-3',
  'focus-visible:ring-ring/50',
  'data-[status=active]:border-primary data-[status=active]:text-foreground',
);

// The graph writes its selection with `history.replaceState`, which the router never sees, so
// the selection is read from the address bar. The router calls each function again at the click.
// shortcut: the `href` of the graph is computed at render and can name an older selection, which
// a click with a modifier opens; read the selection from a store of the graph when one exists.
const TO_MAP = () => carriedSelection(window.location.pathname, window.location.search, '/map');
const TO_GRAPH = () => carriedSelection(window.location.pathname, window.location.search, '/graph');

// The entity page is absent: it names one record and no fixed address reaches it. It is reached
// from the surface that draws that record.
function SurfaceNav() {
  // The map writes its selection through the router. A link keeps the `href` of its first render,
  // so each new address of the router builds the two links again, and each one names the
  // selection of that moment. The graph writes past the router, and its click reads the address.
  const address = useLocation({ select: (location) => location.searchStr });
  return (
    <nav aria-label="Surfaces" className="flex h-full items-stretch">
      <Link
        key={`map${address}`}
        to="/map"
        search={TO_MAP}
        activeOptions={{ includeSearch: false }}
        className={SURFACE_LINK}
      >
        Map
      </Link>
      <Link
        key={`graph${address}`}
        to="/graph"
        search={TO_GRAPH}
        activeOptions={{ includeSearch: false }}
        className={SURFACE_LINK}
      >
        Graph
      </Link>
      <WhenWriterOnline>
        <Link
          to="/review"
          search={{ unit: '', view: 'queue', group: '' }}
          activeOptions={{ includeSearch: false }}
          className={SURFACE_LINK}
        >
          Review
        </Link>
      </WhenWriterOnline>
      <Link to="/search" className={SURFACE_LINK}>
        Search
      </Link>
    </nav>
  );
}

// Making an entity has no entity to hang on, so it hangs on the shell. The router lives here,
// and the dialog states no address of its own.
function NewEntityControl() {
  const router = useRouter();
  return (
    <CreateEntityDialog
      onCreated={() => refreshCorpus(() => router.invalidate())}
      onOpenEntity={(entityId) => {
        void router.navigate({
          to: '/entity/$id',
          params: { id: entityId },
          search: { src: null },
        });
      }}
    />
  );
}

// This wrapper reads the theme inside the provider, because a component cannot read a context
// that it renders itself. `ModeToggle` therefore takes plain values and stays storiable.
function ThemeControl() {
  const { theme, setTheme } = useTheme();
  return <ModeToggle theme={theme} onThemeChange={setTheme} />;
}

function RootError({ error }: { error: Error }) {
  return (
    <div className="p-4">
      <p>The application failed.</p>
      <pre>{error.message}</pre>
    </div>
  );
}
