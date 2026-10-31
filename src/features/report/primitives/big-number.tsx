import { cn } from '@/shared/lib/utils';
import { NoteRef } from '../note-ref';
import { RichText } from '../rich-text';
import { accent } from './accent';
import { monoLabel } from './label';
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
        className={cn('pb-[0.12em] leading-[0.82] tracking-[-0.06em] tabular-nums', accent.text)}
        // The value fills the width of its box at most: a figure of the grotesk is about 0.6em wide.
        style={{
          fontSize: `clamp(3rem, min(22vw, ${String(Math.floor(100 / (value.length * 0.6)))}cqi), 13rem)`,
        }}
      >
        <NumberRoll value={value} />
      </p>
      <p className={cn('mt-4 max-w-[36ch]', monoLabel)}>
        {label}
        {note === undefined ? null : <NoteRef partSlug={note.partSlug} id={note.id} />}
      </p>
      {source === undefined ? null : (
        <p className="mt-2 max-w-[48ch] text-body-sm text-foreground/75">
          <RichText text={source} partSlug={note?.partSlug} />
        </p>
      )}
    </div>
  );
}
