import { createRouter, useRouter } from '@tanstack/react-router';
import { Button } from '@/shared/ui/button';
import { ErrorNotice } from '@/shared/error-notice';
import { refreshCorpus } from '@/shared/read/corpus';
import { keepOperatorKey } from '@/shared/write/operator-key';
import { recheckWriter } from '@/shared/write/writer-status';
import { routeTree } from './routeTree.gen';

// The router default answers an unknown path. An unknown entity identifier is a different
// fault, and `routes/entity.$id.tsx` answers that one with its own words.
function PathNotFound() {
  const router = useRouter();

  // A typed address can be the first entry in the history. Then there is no page to go back to.
  return (
    <div>
      <p>This address does not name a page.</p>
      {router.history.canGoBack() && (
        <Button
          variant="outline"
          onClick={() => {
            router.history.back();
          }}
        >
          Go back
        </Button>
      )}
    </div>
  );
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
      <p>Loading…</p>
    </div>
  );
}

// The router reads the address when it is created, so the key leaves the address first.
keepOperatorKey();

export const router = createRouter({
  routeTree,
  defaultNotFoundComponent: PathNotFound,
  defaultErrorComponent: RouteError,
  defaultPendingComponent: RoutePending,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
