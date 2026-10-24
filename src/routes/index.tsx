import { createFileRoute } from '@tanstack/react-router';

import { ReadingPage } from '@/shared/page/reading-page';

// The report page is empty on purpose: its content is cleared until the operator supplies it.
export const Route = createFileRoute('/')({
  component: () => (
    <ReadingPage>
      <h1 className="sr-only">Report</h1>
    </ReadingPage>
  ),
  head: () => ({ meta: [{ title: 'Report · GAB' }] }),
});
