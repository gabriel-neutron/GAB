import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router';
import { ModeToggle } from '@/shared/mode-toggle';
import { ThemeProvider } from '@/shared/theme-provider';

// No navigation. The layout is deferred to a prototype, so a route is reached by typing its
// address. The theme switch is a control and not navigation, so it lives here, where every
// route can reach it.
export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,

  // The title of the last resort. Every route below sets its own, and this one is read only
  // where none does — the error page and the unknown path.
  head: () => ({ meta: [{ title: 'Gabriel' }] }),
});

function RootLayout() {
  return (
    <ThemeProvider>
      {/* `HeadContent` writes the `head` of each matched route into the document. Without it
          the `title` below is computed and never applied, so a screen reader reports the same
          name on every route. See #39. */}
      <HeadContent />
      <div className="min-h-svh p-4">
        <ModeToggle />
        {/* One `main` for the whole application, and not one per page. A landmark that every
            route declares for itself is a landmark that one route forgets. */}
        <main>
          <Outlet />
        </main>
      </div>
    </ThemeProvider>
  );
}

function RootError({ error }: { error: Error }) {
  return (
    <div className="p-4">
      <p>The application failed.</p>
      <pre>{error.message}</pre>
    </div>
  );
}
