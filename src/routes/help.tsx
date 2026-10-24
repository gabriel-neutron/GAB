import { createFileRoute } from '@tanstack/react-router';

import { HelpPage } from '@/features/help/help-page';
import { loadCorpus } from '@/shared/read/corpus';

export const Route = createFileRoute('/help')({
  loader: async () => {
    // The record is read first, so the footer knows whether the service answers.
    await loadCorpus().catch(() => undefined);
  },
  component: HelpPage,
  head: () => ({ meta: [{ title: 'Help · GAB dataset' }] }),
});
