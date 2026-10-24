import { createFileRoute } from '@tanstack/react-router';

import { HelpPage } from '@/features/help/help-page';

// The page reads no record, so it renders the same in the application and on the site.
export const Route = createFileRoute('/help')({
  component: HelpPage,
  head: () => ({ meta: [{ title: 'Help · GAB dataset' }] }),
});
