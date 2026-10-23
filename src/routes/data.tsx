import { createFileRoute } from '@tanstack/react-router';

import { DataPage } from '@/features/data/data-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadReleaseOrNull } from '@/shared/read/release-record';

// The files exist in a release and nowhere else, so the page reads the release whether the read
// service answers or not. A link points at the copy of the file that sits beside the application.
const fileHref = (path: string): string => `${import.meta.env.BASE_URL}release/${path}`;

export const Route = createFileRoute('/data')({
  loader: async () => {
    // The record is read first, so the footer knows whether the service answers.
    await loadCorpus().catch(() => undefined);
    return loadReleaseOrNull();
  },
  component: DataRoute,
  head: () => ({ meta: [{ title: 'Data · GAB dataset' }] }),
});

function DataRoute() {
  return <DataPage release={Route.useLoaderData()} fileHref={fileHref} />;
}
