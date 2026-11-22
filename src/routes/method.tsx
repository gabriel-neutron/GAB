import { createFileRoute } from '@tanstack/react-router';

import { MethodPage } from '@/features/method/method-page';
import { loadReleaseOrNull } from '@/shared/read/release-record';

// The About page carries the disclaimer, the counts and the contacts of a release, so the page
// reads the release whether the read service answers or not.
export const Route = createFileRoute('/method')({
  loader: async () => {
    return (await loadReleaseOrNull())?.manifest ?? null;
  },
  component: MethodRoute,
  head: () => ({ meta: [{ title: 'About · GAB dataset' }] }),
});

function MethodRoute() {
  return <MethodPage manifest={Route.useLoaderData()} />;
}
