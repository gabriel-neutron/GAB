import { createFileRoute } from '@tanstack/react-router';
import { ReportPage } from '@/features/report/report-page';
import { reportTitles } from '@/features/report/titles';
export const Route = createFileRoute('/')({
  component: ReportPage,
  head: () => ({ meta: [{ title: `${reportTitles.en} · GAB` }] }),
});
