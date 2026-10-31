import { Link } from '@tanstack/react-router';

import { READING_LINK } from '@/shared/page/reading-link';

/** The foot of every page: the links that belong to no section of the header. */
export function SiteFooter() {
  return (
    <footer className="flex shrink-0 items-center gap-4 border-t border-border px-4 py-1 text-body-sm">
      <nav aria-label="Notes" className="flex gap-4">
        <Link to="/ai-use" className={READING_LINK}>
          AI use
        </Link>
      </nav>
    </footer>
  );
}
