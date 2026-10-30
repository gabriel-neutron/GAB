import { Link } from '@tanstack/react-router';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/ui/popover';
import { cn } from '@/shared/lib/utils';
import { parts, ui } from './content';
import { RichText } from './rich-text';

const FOCUS =
  'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring';

interface NoteRefProps {
  readonly partSlug: string;
  readonly id: string;
}

// Two exports, one job: the marker links to the anchor that the notes page writes.
/** The anchor of one note on the notes page. */
export const noteAnchor = (partSlug: string, id: string): string => `note-${partSlug}-${id}`;

/** A note marker: a small superscript that opens the text of the note. */
export function NoteRef({ partSlug, id }: NoteRefProps) {
  const note = parts.find((part) => part.slug === partSlug)?.notes.find((one) => one.id === id);
  if (note === undefined) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${ui.note.label} ${id}`}
          className={cn(
            'relative ml-0.5 cursor-pointer align-super font-mono text-small/none text-label',
            'transition-colors duration-150 hover:text-foreground',
            // A centred 44px box for a finger; it does not move the text.
            'before:absolute before:top-1/2 before:left-1/2 before:size-11 before:-translate-1/2 before:content-[""]',
            FOCUS,
          )}
        >
          {id.slice(id.lastIndexOf('-') + 1)}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" className="w-80 max-w-[calc(100vw-32px)] space-y-2 p-3">
        <p className="font-mono text-caption uppercase text-label">
          {ui.note.label} {id}
        </p>
        <p className="text-body-sm break-words">
          <RichText text={note.text} partSlug={partSlug} />
        </p>
        <Link
          to="/bibliography"
          hash={noteAnchor(partSlug, id)}
          className={cn(
            'inline-flex min-h-11 items-center text-body-sm underline decoration-border underline-offset-4 hover:decoration-foreground',
            FOCUS,
          )}
        >
          {ui.note.all}
        </Link>
      </PopoverContent>
    </Popover>
  );
}
