import { Link } from '@tanstack/react-router';

import { Button } from '@/shared/ui/button';

export function NotAvailable() {
  return (
    <div className="flex h-full flex-col items-start gap-2 p-4">
      <p>This part is not available here.</p>
      <Button asChild variant="outline">
        <Link to="/map" search={{ entity: '', relation: '' }}>
          Go to the map
        </Link>
      </Button>
    </div>
  );
}
