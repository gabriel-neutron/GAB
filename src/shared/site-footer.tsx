import { releaseDay } from '@gab/release/release-day';

import type { ReleaseNote } from '@/shared/read/release-note';

export interface SiteFooterProps {
  readonly note: ReleaseNote;
}

const LINK =
  'underline decoration-border underline-offset-2 transition-colors duration-100 outline-none hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/50';

/** The foot of every page when the application reads the files of its release: the day of the
 * version and the two contact links of the release. No page says the data is live. */
export function SiteFooter({ note }: SiteFooterProps) {
  return (
    <footer className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border px-2 py-1.5 text-small/4 text-label">
      <p>Version of {releaseDay(note.date)}</p>
      <a className={LINK} href={note.reportError}>
        Report an error
      </a>
      <a className={LINK} href={note.rightOfReply}>
        Right of reply
      </a>
    </footer>
  );
}
