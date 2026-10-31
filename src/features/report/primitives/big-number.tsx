import { cn } from '@/shared/lib/utils';
import { NoteRef } from '../note-ref';
import { RichText } from '../rich-text';
import { accent } from './accent';
import { monoNote } from './label';
import { NumberRoll } from './number-roll';

interface BigNumberProps {
  /** The value exactly as the report text writes it, for example "79%". */
  readonly value: string;
  readonly label: string;
  /** The note of the report text that gives the value. */
  readonly note?: { readonly partSlug: string; readonly id: string } | undefined;
  /** A source line in report text; it can hold the note markers of the note part. */
  readonly source?: string | undefined;
}

/** One value of the report, alone and huge in the accent, with its mono label and its note. */
export function BigNumber({ value, label, note, source }: BigNumberProps) {
  return (
    <div className="@container min-w-0">
      <p
        // The bottom padding keeps the descender of a comma clear of the label.
        className={cn(
          'pb-[0.12em] text-report-display leading-[0.82] tracking-[-0.06em] tabular-nums',
          accent.text,
        )}
      >
        <NumberRoll value={value} />
      </p>
      <p className={cn('mt-4 max-w-[36ch]', monoNote)}>
        {label}
        {note === undefined ? null : <NoteRef partSlug={note.partSlug} id={note.id} />}
      </p>
      {source === undefined ? null : (
        <p className="mt-2 max-w-[48ch] text-report-small text-foreground/75">
          <RichText text={source} partSlug={note?.partSlug} />
        </p>
      )}
    </div>
  );
}
