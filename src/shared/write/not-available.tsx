import { Link } from '@tanstack/react-router';

import { PageHeader } from '@/shared/page/page-header';
import { ReadingPage } from '@/shared/page/reading-page';
import { Button } from '@/shared/ui/button';

export function NotAvailable() {
  return (
    <ReadingPage>
      <PageHeader title="Not available" />
      <p>This part is not available here.</p>
      <div>
        <Button asChild variant="outline">
          <Link to="/map" search={{ entity: '' }}>
            Go to the map
          </Link>
        </Button>
      </div>
    </ReadingPage>
  );
}
