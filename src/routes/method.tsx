import { createFileRoute } from '@tanstack/react-router';

import { MethodPage } from '@/features/method/method-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadReleaseOrNull } from '@/shared/read/release-record';

// The method text carries the disclaimer, the date rules and the counts of a release, so the page
// reads the release whether the read service answers or not.
export const Route = createFileRoute('/method')({
  loader: async () => {
    // The record is read first, so the footer knows whether the service answers.
    await loadCorpus().catch(() => undefined);
    return (await loadReleaseOrNull())?.manifest ?? null;
  },
  component: MethodRoute,
  head: () => ({ meta: [{ title: 'Method · GAB dataset' }] }),
});

function MethodRoute() {
  return <MethodPage manifest={Route.useLoaderData()} />;
}
