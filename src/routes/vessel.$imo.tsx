import { createFileRoute } from '@tanstack/react-router';

import { claimHref, entityHref } from '@/features/detail/address';
import { VesselPage } from '@/features/vessel/vessel-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadReleaseOrNull } from '@/shared/read/release-record';

// The timeline of a vessel exists in a release and nowhere else, so it reads the release files
// whether the read service answers or not. A site with no release files shows one sentence.
export const Route = createFileRoute('/vessel/$imo')({
  loader: async () => {
    // The record is read first, so the footer knows whether the service answers.
    await loadCorpus().catch(() => undefined);
    return loadReleaseOrNull();
  },
  component: VesselRoute,
  head: ({ params }) => ({ meta: [{ title: `IMO ${params.imo} · GAB dataset` }] }),
});

function VesselRoute() {
  const { imo } = Route.useParams();
  const release = Route.useLoaderData();
  return (
    <VesselPage
      release={release}
      imo={imo}
      entityHref={(id) => entityHref(id, null)}
      claimHref={claimHref}
    />
  );
}
