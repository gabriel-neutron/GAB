import { createFileRoute } from '@tanstack/react-router';
import { claimHref, entityHref, vesselHref } from '@/features/detail/address';
import { NodesPage } from '@/features/nodes/nodes-page';
import { claimText } from '@gab/release/claim-text';
import { pairRating } from '@gab/release/site-release';
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
        manifest: release.manifest,
        nodes: release.criticalNodes,
        claims: Object.fromEntries(
          release.claims.map((claim) => [
            claim.id,
            { text: claimText(claim), rating: pairRating(release.manifest, claim) },
          ]),
        ),
        imoOf: Object.fromEntries(release.imoOfVessel),
      };
    } catch (cause) {
      if (cause instanceof ReleaseAbsent) return null;
      throw cause;
    }
  },
  component: NodesRoute,
  head: ({ loaderData }) => {
    const coverage = loaderData?.manifest.coverage ?? null;
    return {
      meta: [
        { title: 'GAB dataset: release overview' },
        {
          name: 'description',
          content:
            coverage === null
              ? 'Overview of a release of the GAB dataset: the labels of its claims and its critical nodes.'
              : `Release ${loaderData?.manifest.version ?? ''} of the GAB dataset: ${String(coverage.entities)} entities and ${String(coverage.sources)} sources, the labels of its claims and its critical nodes.`,
        },
      ],
    };
  },
});

function NodesRoute() {
  const release = Route.useLoaderData();
  return (
    <NodesPage
      release={release}
      entityHref={(id) => entityHref(id, null)}
      vesselHref={vesselHref}
      claimHref={claimHref}
    />
  );
}
