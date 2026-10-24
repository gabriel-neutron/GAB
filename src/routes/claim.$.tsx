import { createFileRoute } from '@tanstack/react-router';

import { ClaimPage } from '@/features/claim/claim-page';
import { claimHref, entityHref } from '@/features/detail/address';
import { claimText } from '@gab/release/claim-text';
import { loadCorpus } from '@/shared/read/corpus';
import { loadReleaseOrNull } from '@/shared/read/release-record';

// A claim exists in a release and nowhere else, so the page reads the release files whether the
// read service answers or not. The identifier is the path, so it can hold a `/`.
export const Route = createFileRoute('/claim/$')({
  loader: async () => {
    await loadCorpus().catch(() => undefined);
    return loadReleaseOrNull();
  },
  component: ClaimRoute,
  head: ({ params, loaderData }) => {
    const claim = loaderData?.claimById.get(params._splat ?? '');
    const text = claim === undefined ? 'Claim' : claimText(claim);
    return {
      meta: [
        { title: `${text} · GAB dataset` },
        {
          name: 'description',
          content: `${text}. The label that tells who decided this claim, and the documents that state it.`,
        },
      ],
    };
  },
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
