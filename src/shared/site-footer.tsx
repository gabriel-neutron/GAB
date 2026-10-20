import { releaseDay } from '@gab/release/release-day';

import { readTimeText } from '@/shared/read/read-time';
import type { ReleaseNote } from '@/shared/read/release-note';

export interface SiteFooterProps {
  /** Null while the service answers: the record is then the live one and no page names a version. */
  readonly note: ReleaseNote | null;
  /** The time of the read of the record. */
  readonly readAt: Date;
}

const LINK =
  'underline decoration-border underline-offset-2 transition-colors duration-100 outline-none hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ring/50';

/** The foot of every page: the time of the read of the record, with one line that says the counts
 * follow the record. When the application reads the files of its release, it also gives the day
 * of the version, the licence of the dataset and the two contact links of the release. No page
 * says the data is live. */
export function SiteFooter({ note, readAt }: SiteFooterProps) {
  return (
    <footer className="flex shrink-0 flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-border px-2 py-1.5 text-small/4 text-label">
      <p>Record read at {readTimeText(readAt)}</p>
      <p>The counts follow the record and change after each review.</p>
      {note === null ? null : (
        <>
          <p>Version of {releaseDay(note.date)}</p>
          <p>The dataset is under CC-BY 4.0. Each row gives its own licence.</p>
          <a className={LINK} href={note.reportError}>
            Report an error
          </a>
          <a className={LINK} href={note.rightOfReply}>
            Right of reply
          </a>
        </>
      )}
    </footer>
  );
}
