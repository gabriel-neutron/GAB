import { createFileRoute } from '@tanstack/react-router';

import { RelationPage } from '@/features/claim/relation-page';
import { claimHref } from '@/features/detail/address';
import { loadCorpus } from '@/shared/read/corpus';
import { loadReleaseOrNull } from '@/shared/read/release-record';

// The old address of a relation. The identifier is the path, so it can hold a `/`.
export const Route = createFileRoute('/relation/$')({
  loader: async () => {
    await loadCorpus().catch(() => undefined);
    return loadReleaseOrNull();
  },
  component: RelationRoute,
  head: ({ params }) => ({ meta: [{ title: `Relation ${params._splat ?? ''} · GAB dataset` }] }),
});

function RelationRoute() {
  const { _splat } = Route.useParams();
  const release = Route.useLoaderData();
  return <RelationPage release={release} relationId={_splat ?? ''} claimHref={claimHref} />;
}
