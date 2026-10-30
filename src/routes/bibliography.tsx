import { createFileRoute } from '@tanstack/react-router';
import { ReportPage } from '@/features/report/report-page';
export const Route = createFileRoute('/bibliography')({
  component: () => <ReportPage bibliography />,
  head: () => ({ meta: [{ title: 'Report bibliography · GAB' }] }),
});
