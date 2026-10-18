import { createFileRoute } from '@tanstack/react-router';
import { entityHref } from '@/features/detail/address';
import { NodesPage } from '@/features/nodes/nodes-page';
import { loadRelease } from '@/shared/read/release-record';

// The critical nodes table exists in a release and nowhere else, so it reads the release files
// whether the read service answers or not. A site with no release files shows one sentence.
export const Route = createFileRoute('/')({
  loader: async () => {
    try {
      const release = await loadRelease();
      return { date: release.manifest.date, nodes: release.criticalNodes };
    } catch {
      return null;
    }
  },
  component: NodesRoute,
  head: () => ({ meta: [{ title: 'Critical nodes · GAB dataset' }] }),
});

function NodesRoute() {
  const release = Route.useLoaderData();
  return <NodesPage release={release} entityHref={(id) => entityHref(id, null)} />;
}
