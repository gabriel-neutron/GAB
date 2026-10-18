import { createFileRoute } from '@tanstack/react-router';

import { ClaimPage } from '@/features/claim/claim-page';
import { claimHref, entityHref } from '@/features/detail/address';
import { loadCorpus } from '@/shared/read/corpus';
import { loadReleaseOrNull } from '@/shared/read/release-record';

// A claim exists in a release and nowhere else, so the page reads the release files whether the
// read service answers or not. The identifier is the path, so it can hold a `/`.
export const Route = createFileRoute('/claim/$')({
  loader: async () => {
    // The record is read first, so the footer knows whether the service answers.
    await loadCorpus().catch(() => undefined);
    return loadReleaseOrNull();
  },
  component: ClaimRoute,
  head: ({ params }) => ({ meta: [{ title: `Claim ${params._splat ?? ''} · GAB dataset` }] }),
});

function ClaimRoute() {
  const { _splat } = Route.useParams();
  const release = Route.useLoaderData();
  return (
    <ClaimPage
      release={release}
      claimId={_splat ?? ''}
      entityHref={(id) => entityHref(id, null)}
      claimHref={claimHref}
    />
  );
}
