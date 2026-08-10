import { createRootRoute, Outlet } from '@tanstack/react-router';
import { ModeToggle } from '@/shared/mode-toggle';
import { ThemeProvider } from '@/shared/theme-provider';

// No navigation. The layout is deferred to a prototype, so a route is reached by typing its
// address. The theme switch is a control and not navigation, so it lives here, where every
// route can reach it.
export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootError,
});

function RootLayout() {
  return (
    <ThemeProvider>
      <div className="min-h-svh p-4">
        <ModeToggle />
        <Outlet />
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
