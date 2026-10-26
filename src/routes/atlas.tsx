import { createFileRoute, redirect } from '@tanstack/react-router';

// The Atlas was the first name of the map. An address that names it opens the map, with the same
// selection. `redirect({ throw: true })` does not return `never` in its type, so the throw below
// states it.
export const Route = createFileRoute('/atlas')({
  beforeLoad: ({ location }) => {
    const params = new URLSearchParams(location.searchStr);
    redirect({
      to: '/map',
      search: { entity: params.get('entity') ?? '', relation: params.get('relation') ?? '' },
      replace: true,
      throw: true,
    });
    throw new Error('The router did not raise the redirect.');
  },
});
