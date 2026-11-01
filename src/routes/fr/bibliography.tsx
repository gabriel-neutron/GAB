import { createFileRoute } from '@tanstack/react-router';
import { BibliographyPage } from '@/features/report/bibliography-page';
import { fr } from '@/features/report/content-fr';
import { ContentContext } from '@/features/report/use-content';

// The notes of the French report, with the French copy of the content.
export const Route = createFileRoute('/fr/bibliography')({
  component: () => (
    <ContentContext.Provider value={fr}>
      <BibliographyPage />
    </ContentContext.Provider>
  ),
  head: () => ({ meta: [{ title: 'Bibliographie du rapport · GAB' }] }),
});
