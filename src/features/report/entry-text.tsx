import { cn } from '@/shared/lib/utils';
import type { Entry } from './bibliography';

const LINK =
  'underline decoration-border underline-offset-4 hover:decoration-foreground break-all outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';

/** One entry of the bibliography in full: issuer, date, title, the words after the title, and the
 * address. */
export function EntryText({
  entry,
  className,
}: {
  readonly entry: Entry;
  readonly className?: string;
}) {
  return (
    <span className={cn('break-words', className)}>
      {entry.issuer} ({entry.date}). <em>{entry.title}</em>.
      {entry.detail === undefined ? null : ` ${entry.detail}.`}{' '}
      <a href={entry.url} className={LINK}>
        {entry.url}
      </a>
    </span>
  );
}
