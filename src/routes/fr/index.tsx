import { createFileRoute } from '@tanstack/react-router';
import { fr } from '@/features/report/content-fr';
import { ReportPage } from '@/features/report/report-page';
import { reportTitles } from '@/features/report/titles';
import { ContentContext } from '@/features/report/use-content';

// The French report: the same page, with the French copy of the content.
export const Route = createFileRoute('/fr/')({
  component: () => (
    <ContentContext.Provider value={fr}>
      <ReportPage />
    </ContentContext.Provider>
  ),
  head: () => ({ meta: [{ title: `${reportTitles.fr} · GAB` }] }),
});
