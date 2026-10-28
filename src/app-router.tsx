import { createRouter, useRouter, type RouterHistory } from '@tanstack/react-router';
import { AsciiLoading } from '@/shared/ascii/ascii-loading';
import { AsciiNotFound } from '@/shared/ascii/ascii-not-found';
import { ErrorNotice } from '@/shared/error-notice';
import { refreshCorpus } from '@/shared/read/corpus';
import { recheckWriter } from '@/shared/write/writer-status';
import { routeTree } from './routeTree.gen';

// The router default answers an unknown path. An unknown entity identifier is a different
// fault, and `routes/entity.$id.tsx` answers that one with its own words.
function PathNotFound() {
  return <AsciiNotFound />;
}

// Every surface reads the record through one loader, so a read that fails is the usual cause of
// this screen. `refreshCorpus` forgets each answer that is held and then runs each loader again,
// so the retry always asks the read API a second time, after a failure and after a success.
function RouteError({ error }: { error: Error }) {
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

// The container states a height. `<main>` is a flex child of a column, so a bare paragraph here
// gives the row no height, and the row jumps to its full height when the page arrives.
function RoutePending() {
  return (
    <div className="flex h-full items-center justify-center p-4">
      <AsciiLoading />
    </div>
  );
}

// The base of the site is a folder of the host, or the root. The router wants it with no end slash.
const basepath = (): string => import.meta.env.BASE_URL.replace(/\/+$/u, '');

/** The router of the application. The browser entry gives no history, and the render at the release
 * gives a history in memory, so one router serves both. */
export const createAppRouter = (history?: RouterHistory) =>
  createRouter({
    routeTree,
    ...(history === undefined ? {} : { history }),
    basepath: basepath(),
    // An old address of the site ends with a slash, and it opens the same page.
    trailingSlash: 'never',
    defaultNotFoundComponent: PathNotFound,
    defaultErrorComponent: RouteError,
    defaultPendingComponent: RoutePending,
  });

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
