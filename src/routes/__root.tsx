import { createRootRoute, HeadContent, Outlet } from '@tanstack/react-router';
import { ModeToggle } from '@/shared/mode-toggle';
import { ThemeProvider, useTheme } from '@/shared/theme-provider';

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
      {/* **The shell owns the height of a page, and it is the only place that states one** —
          #92. The three routes each subtracted `calc(100svh - 6rem)` by hand, tracking a padding
          and a control height that no file declared. The number was right by coincidence and
          wrong the day either one changed, and each route reported it under ASK.

          The column is the viewport. The header states its own height and never grows, and the
          row below takes everything that is left. `min-h-0` is what lets that row hold a scroll
          of its own instead of growing to its content and pushing the window. */}
      <div className="flex h-svh flex-col">
        {/* The header of the application. **Its height is stated here and nowhere else.** The
            theme control lives in it, and never above `<main>` in normal flow, where it pushed
            every page down by an amount no page could read. #71 owns the control itself. */}
        <header className="flex h-10 shrink-0 items-center justify-end px-2">
          <ThemeControl />
        </header>
        {/* One `main` for the whole application, and not one per page. A landmark that every
            route declares for itself is a landmark that one route forgets.

            **It carries no padding.** A page fills it edge to edge, which is what a canvas
            needs. A page that is not a canvas supplies its own inner padding — #92. */}
        <main className="min-h-0 flex-1">
          <Outlet />
        </main>
      </div>
    </ThemeProvider>
  );
}

// The read of the theme lives here, and not in `mode-toggle.tsx`. A component that reads the
// theme itself cannot be mounted with plain values, and it therefore cannot be storied. This
// wrapper sits inside the provider, because a component cannot read a context it renders itself.
// It is not exported, so `shared/mode-toggle.tsx` keeps one runtime symbol.
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
