import { createFileRoute } from '@tanstack/react-router';

import { AiUsePage } from '@/features/ai-use/ai-use-page';
import { loadCorpus } from '@/shared/read/corpus';
import { loadReleaseOrNull } from '@/shared/read/release-record';

// The page carries the contacts of a release, so it reads the release whether the read service
// answers or not.
export const Route = createFileRoute('/ai-use')({
  loader: async () => {
    await loadCorpus().catch(() => undefined);
    return (await loadReleaseOrNull())?.manifest ?? null;
  },
  component: AiUseRoute,
  head: () => ({
    meta: [
      { title: 'AI use · GAB dataset' },
      {
        name: 'description',
        content:
          'How an AI system may use the GAB dataset: the licence, how to cite a claim, the limits of a claim and the contact addresses.',
      },
    ],
  }),
});

function AiUseRoute() {
  return <AiUsePage manifest={Route.useLoaderData()} />;
}
