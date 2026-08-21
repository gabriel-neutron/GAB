import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router';
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
        <header className="flex h-10 shrink-0 items-center justify-end px-2">
          <ThemeControl />
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
