import { createRouter, useRouter } from '@tanstack/react-router';
import { Button } from '@/shared/ui/button';
import { routeTree } from './routeTree.gen';

/**
 * The not-found default of the router answers an unknown **path**. An unknown **entity
 * identifier** is a different fault with a different cause, so `routes/entity.$id.tsx` answers
 * it with its own component and its own words.
 *
 * There is no navigation yet — the layout is deferred to a prototype — so the way back is the
 * history of the browser and not a link to a home page that does not exist.
 */
function PathNotFound() {
  const router = useRouter();

  // The button appears only when there is a page to go back to. A typed address is often the
  // first entry in the history, and a button that does nothing tells the operator that the
  // application failed when it did not.
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

function RouteError({ error }: { error: Error }) {
  return (
    <div>
      <p>This page failed.</p>
      <pre>{error.message}</pre>
    </div>
  );
}

function RoutePending() {
  return <p>Loading…</p>;
}

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
