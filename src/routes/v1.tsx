import { createFileRoute, Link } from '@tanstack/react-router';

import { PageHeader } from '@/shared/page/page-header';
import { READING_LINK } from '@/shared/page/reading-link';
import { ReadingPage } from '@/shared/page/reading-page';

// The old address of the map of version 1. A citation that was made before the move to one site
// still opens a page, and the page says that this site holds no build of that map.
export const Route = createFileRoute('/v1')({
  component: VersionOne,
  head: () => ({ meta: [{ title: 'Version 1 · GAB dataset' }] }),
});

function VersionOne() {
  return (
    <ReadingPage>
      <PageHeader title="Version 1" />
      <p className="max-w-prose">
        This copy of the site holds no build of the version 1 map.{' '}
        <Link to="/" className={READING_LINK}>
          Open the critical nodes.
        </Link>
      </p>
    </ReadingPage>
  );
}
