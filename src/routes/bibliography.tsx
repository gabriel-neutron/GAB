import { createFileRoute } from '@tanstack/react-router';
import { BibliographyPage } from '@/features/report/bibliography-page';
export const Route = createFileRoute('/bibliography')({
  component: BibliographyPage,
  head: () => ({ meta: [{ title: 'Report bibliography · GAB' }] }),
});
