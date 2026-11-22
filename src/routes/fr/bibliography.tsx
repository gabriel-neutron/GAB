import { createFileRoute } from '@tanstack/react-router';
import { ReportNotice } from '@/features/report/report-notice';
import { reportTitles } from '@/features/report/titles';
// The report is out of production until its delivery: the page shows a notice.
export const Route = createFileRoute('/fr/bibliography')({
  component: () => <ReportNotice lang="fr" />,
  head: () => ({ meta: [{ title: `${reportTitles.frNotes} · GAB` }] }),
});
