import { createFileRoute } from '@tanstack/react-router';
import { report } from '@/features/report/content';
import { ReportPage } from '@/features/report/report-page';
export const Route = createFileRoute('/')({
  component: ReportPage,
  head: () => ({ meta: [{ title: `${report.title} · GAB` }] }),
});
