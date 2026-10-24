import { createFileRoute } from '@tanstack/react-router';

import { GlossaryPage } from '@/features/glossary/glossary-page';

// The page holds the same words in the application and on the site, so it reads no record.
export const Route = createFileRoute('/glossary')({
  component: GlossaryPage,
  head: () => ({ meta: [{ title: 'Glossary · GAB dataset' }] }),
});
