import {
  createRootRoute,
  HeadContent,
  Outlet,
  useLocation,
  useRouter,
} from '@tanstack/react-router';
import { CreateEntityDialog } from '@/features/edit/create-entity-dialog';
import { ErrorNotice } from '@/shared/error-notice';
import { refreshCorpus } from '@/shared/read/corpus';
import { ModeToggle } from '@/shared/mode-toggle';
import { ScreenQueryField, ScreenQueryProvider } from '@/shared/screen-query';
import { SiteFooter } from '@/shared/site-footer';
import { SiteHeader } from '@/shared/site-header';
import { ThemeProvider, useTheme } from '@/shared/theme-provider';
import { recheckWriter, useWriterOnline } from '@/shared/write/writer-status';

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,

  // The router uses the deepest title a route sets. This one applies where no route sets one.
  head: () => ({
    meta: [
      { title: 'GAB dataset' },
      {
        name: 'description',
        content:
          'GAB dataset: entities, relations and claims, each with a label that tells who decided it and the documents that state it.',
      },
    ],
  }),
});

// Departure: only these screens read the header filter. The search page has a field of its own,
// and a screen that reads no filter shows no field.
const FILTERED_SCREENS: ReadonlySet<string> = new Set(['/graph']);

function RootLayout() {
  const path = useLocation({ select: (location) => location.pathname });
  const writerOnline = useWriterOnline();
  return (
    <ThemeProvider>
      {/* External constraint: `HeadContent` writes the `head` of a matched route into the
          document. Without it, a title is computed and never applied. */}
      <HeadContent />
      <ScreenQueryProvider path={path}>
        {/* The link shows at the first Tab, so a keyboard reader skips the navigation. */}
        <a
          href="#main"
          className="sr-only z-50 bg-background px-2 py-1 text-body-sm/5 focus:not-sr-only focus:absolute focus:top-0 focus:left-0"
        >
          Skip to the content
        </a>
        {/* Clip, not hidden: an anchor jump can scroll a hidden box and push the header out. */}
        <div className="relative flex h-svh flex-col overflow-clip">
          <SiteHeader
            writerOnline={writerOnline}
            filter={FILTERED_SCREENS.has(path) ? <ScreenQueryField /> : null}
            actions={
              <>
                {writerOnline ? <NewEntityControl /> : null}
                <ThemeControl />
              </>
            }
          />
          {/* External constraint: `min-h-0` lets this row hold a scroll of its own. Without it,
              the row grows to its content and pushes the window. */}
          <main id="main" tabIndex={-1} className="min-h-0 flex-1 outline-none">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
      </ScreenQueryProvider>
    </ThemeProvider>
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
  const router = useRouter();
  return (
    <ErrorNotice
      detail={error.message}
      onRetry={() => {
        void recheckWriter();
        void refreshCorpus(() => router.invalidate());
      }}
    />
  );
}
