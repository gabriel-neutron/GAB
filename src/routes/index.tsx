import { createFileRoute } from '@tanstack/react-router';
import { entityHref, vesselHref } from '@/features/detail/address';
import { NodesPage } from '@/features/nodes/nodes-page';
import { claimText } from '@gab/release/claim-text';
import { loadCorpus } from '@/shared/read/corpus';
import { ReleaseAbsent } from '@/shared/read/release-files';
import { loadRelease } from '@/shared/read/release-record';

// The critical nodes table exists in a release and nowhere else, so it reads the release files
// whether the read service answers or not. A site with no release files shows one sentence.
export const Route = createFileRoute('/')({
  loader: async () => {
    // The record is read first, so the footer knows whether the service answers.
    await loadCorpus().catch(() => undefined);
    try {
      const release = await loadRelease();
      return {
        date: release.manifest.date,
        nodes: release.criticalNodes,
        claimTexts: Object.fromEntries(release.claims.map((claim) => [claim.id, claimText(claim)])),
        imoOf: Object.fromEntries(release.imoOfVessel),
      };
    } catch (cause) {
      if (cause instanceof ReleaseAbsent) return null;
      throw cause;
    }
  },
  component: NodesRoute,
  head: () => ({ meta: [{ title: 'Critical nodes · GAB dataset' }] }),
});

function NodesRoute() {
  const release = Route.useLoaderData();
  return (
    <NodesPage
      release={release}
      entityHref={(id) => entityHref(id, null)}
      vesselHref={vesselHref}
    />
  );
}
