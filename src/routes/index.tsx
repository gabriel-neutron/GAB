import { createFileRoute } from '@tanstack/react-router';
import { ReportPage } from '@/features/report/report-page';
export const Route = createFileRoute('/')({
  component: ReportPage,
  head: () => ({ meta: [{ title: 'Russia’s war economy · GAB' }] }),
});
