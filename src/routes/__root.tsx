import { createRootRoute, HeadContent, Link, Outlet, useRouter } from '@tanstack/react-router';
import { CreateEntityDialog } from '@/features/edit/create-entity-dialog';
import { cn } from '@/shared/lib/utils';
import { refreshCorpus } from '@/shared/read/corpus';
import { ModeToggle } from '@/shared/mode-toggle';
import { ThemeProvider, useTheme } from '@/shared/theme-provider';

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,

  // The router uses the deepest title a route sets. This one applies where no route sets one.
  head: () => ({ meta: [{ title: 'Gabriel' }] }),
});

function RootLayout() {
  return (
    <ThemeProvider>
      {/* `HeadContent` writes the `head` of a matched route into the document. Without it, a
          title is computed and never applied. */}
      <HeadContent />
      <div className="flex h-svh flex-col">
        <header className="flex h-10 shrink-0 items-center justify-between border-b border-border px-2">
          <SurfaceNav />
          <div className="flex items-center gap-2">
            <NewEntityControl />
            <ThemeControl />
          </div>
        </header>
        {/* `min-h-0` lets this row hold a scroll of its own. Without it, the row grows to its
            content and pushes the window. */}
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
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

// The empty search is written out because the graph declares both keys and strips neither. A
// link that carries no search would open the graph on a pair of parameters it never validated.
const NO_SELECTION = { entity: '', relation: '' } as const;

// The entity page is absent: it names one record and no fixed address reaches it. It is reached
// from the surface that draws that record.
function SurfaceNav() {
  return (
    <nav aria-label="Surfaces" className="flex h-full items-stretch">
      <Link
        to="/map"
        search={NO_SELECTION}
        activeOptions={{ includeSearch: false }}
        className={SURFACE_LINK}
      >
        Map
      </Link>
      <Link
        to="/graph"
        search={NO_SELECTION}
        activeOptions={{ includeSearch: false }}
        className={SURFACE_LINK}
      >
        Graph
      </Link>
      <Link
        to="/review"
        search={{ subject: '' }}
        activeOptions={{ includeSearch: false }}
        className={SURFACE_LINK}
      >
        Review
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
