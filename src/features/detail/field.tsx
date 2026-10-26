import { useId } from 'react';

import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';
import { Textarea } from '@/shared/ui/textarea';

import type { ClaimValue, TypedValue } from './claims';
import type { ClaimDraft } from './draft';
import { ENTRY_ROW } from './entry-row';

export type FieldProps =
  | {
      readonly mode: 'reading';
      readonly label: string;
      readonly value: ClaimValue;
    }
  | {
      readonly mode: 'writing';
      readonly label: string;
      readonly draft: ClaimDraft;
      readonly onEdit: (typed: TypedValue) => void;
    };

// The geometry both arms share, with the 150ms of the design system stated.
const SURFACE = 'w-full duration-150';
const BOX = cn(SURFACE, ENTRY_ROW.box);

// A text box removes each line break from its value, so a note takes a textarea. One line of
// `text-body-sm` is 20 px, and `py-1.5` adds 12 px, so one line stands at the 32 px of the other
// boxes.
const NOTE = cn(SURFACE, ENTRY_ROW.box, 'h-auto min-h-8 resize-none py-1.5');

// A story reads no colour and no class, so a read-only control states in a word that it takes no
// edit and that the fade of the kit is beaten.
const UNFADED = 'unfaded';

// The figures are not right-aligned. Alignment is for a column of figures, and the cells flow
// about 2.6 to a line, so a right edge would land at a different place on each cell, far from the
// name it belongs to. `tabular-nums` still holds the digits on one width.
const FIGURES = 'font-mono text-data tabular-nums';

// `appearance-none` takes the paint of the browser away, so every colour of the box comes from a
// token. It also removes the grey a browser gives a disabled checkbox, which is not opacity and
// which `disabled:opacity-100` cannot reach.
const TICK_BOX = 'inline-flex h-8 shrink-0 items-center';
const TICK =
  'size-3.5 shrink-0 appearance-none rounded-sm border border-input bg-transparent checked:border-foreground checked:bg-foreground';
const TICK_WRITING =
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

const SENTENCE = 'block text-body-sm text-muted-foreground';

// A value that nobody edits is text in the page, so it reaches a reader with no script and a
// search engine. A disabled control would keep it in an attribute, out of the text of the page.
function ReadOnlyField({ value }: { label: string; value: ClaimValue }) {
  const figures = value.control === 'number' || value.control === 'date';
  return (
    <span
      title={value.text}
      data-reading={UNFADED}
      className={cn(
        'block w-full min-w-0 text-body-sm break-words whitespace-pre-wrap',
        figures && FIGURES,
      )}
    >
      {value.text}
    </span>
  );
}

function WritingField({
  label,
  draft,
  onEdit,
  describedBy,
}: {
  label: string;
  draft: ClaimDraft;
  onEdit: (typed: TypedValue) => void;
  describedBy: string | undefined;
}) {
  const value = draft.value;
  const invalid = draft.refusal !== null;

  if (value.control === 'boolean') {
    return (
      <span className={cn(TICK_BOX)}>
        <input
          type="checkbox"
          checked={value.checked}
          onChange={(event) => {
            onEdit(event.target.checked);
          }}
          aria-label={label}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          title={value.text}
          className={cn(TICK, TICK_WRITING)}
        />
      </span>
    );
  }

  const typed = (event: { readonly target: { readonly value: string } }): void => {
    onEdit(event.target.value);
  };

  if (value.control === 'note') {
    return (
      <Textarea
        value={value.text}
        onChange={typed}
        aria-label={label}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        title={value.text}
        className={NOTE}
      />
    );
  }

  // A number takes a text box with a decimal input mode. A native number control reads and
  // prints in the locale of the machine, and `43,5` then reaches the record as `NaN`.
  const kind = value.control === 'date' ? 'date' : 'text';

  return (
    <Input
      type={kind}
      inputMode={value.control === 'number' ? 'decimal' : undefined}
      value={value.text}
      onChange={typed}
      aria-label={label}
      aria-invalid={invalid}
      aria-describedby={describedBy}
      title={value.text}
      className={cn(BOX, value.control === 'number' || value.control === 'date' ? FIGURES : '')}
    />
  );
}

export function Field(props: FieldProps) {
  const said = useId();

  // A read-only claim states no sentence beside it. Nothing makes a claim unwritable now, so a
  // record that is read through is read through whole, and never one refused row at a time.
  if (props.mode === 'reading') return <ReadOnlyField label={props.label} value={props.value} />;

  const refusal = props.draft.refusal;
  return (
    <span className="block">
      <WritingField
        label={props.label}
        draft={props.draft}
        onEdit={props.onEdit}
        describedBy={refusal === null ? undefined : said}
      />
      {refusal === null ? null : (
        // A refusal is never a colour alone. The sentence stands under the box, and
        // `aria-invalid` carries the same fact to a screen reader.
        <span id={said} role="alert" className={cn(SENTENCE, 'text-destructive')}>
          {refusal}
        </span>
      )}
    </span>
  );
}
