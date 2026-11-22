import { createFileRoute } from '@tanstack/react-router';
import { ReportNotice } from '@/features/report/report-notice';
// The report is out of production until its delivery: the page shows a notice.
export const Route = createFileRoute('/bibliography')({
  component: () => <ReportNotice />,
  head: () => ({ meta: [{ title: 'Report bibliography · GAB' }] }),
});
