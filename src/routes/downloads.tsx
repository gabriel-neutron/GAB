import { createFileRoute } from '@tanstack/react-router';

import { DownloadsPage } from '@/features/downloads/downloads-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadReleaseOrNull } from '@/shared/read/release-record';

// The files exist in a release and nowhere else, so the page reads the release whether the read
// service answers or not. A link points at the copy of the file that sits beside the application.
const fileHref = (path: string): string => `${import.meta.env.BASE_URL}release/${path}`;

export const Route = createFileRoute('/downloads')({
  loader: async () => {
    await loadCorpus().catch(() => undefined);
    return (await loadReleaseOrNull())?.manifest ?? null;
  },
  component: DownloadsRoute,
  head: () => ({ meta: [{ title: 'Downloads · GAB dataset' }] }),
});

function DownloadsRoute() {
  return <DownloadsPage manifest={Route.useLoaderData()} fileHref={fileHref} />;
}
