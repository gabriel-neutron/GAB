import { createRouter, useRouter } from '@tanstack/react-router';
import { Button } from '@/shared/ui/button';
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
