import { useId } from 'react';

import { cn } from '@/shared/lib/utils';
import { Input } from '@/shared/ui/input';

import type { ClaimValue, TypedValue } from './claims';
import type { ClaimDraft } from './draft';

export type FieldProps =
  | {
      readonly mode: 'reading';
      readonly label: string;
      readonly value: ClaimValue;
      /** Why the value stands and takes no change here. It is drawn in words. */
      readonly note: string | null;
    }
  | {
      readonly mode: 'writing';
      readonly label: string;
      readonly draft: ClaimDraft;
      readonly onEdit: (typed: TypedValue) => void;
    };

// The geometry both arms share. The kit gives `transition-colors` no duration, and the Tailwind
// default is 150ms, so 100ms is stated here.
const BOX =
  'h-6 w-full rounded-none border-transparent bg-muted px-1.5 py-0 text-xs duration-100 md:text-xs dark:bg-muted';

// A story reads no colour and no class, so a read-only control states in a word that it takes no
// edit and that the fade of the kit is beaten.
const UNFADED = 'unfaded';

// The shadcn kit sets `opacity-50`, a dark fill, and `disabled:pointer-events-none`, which killed
// every `title`. Each is beaten here, and each belongs to the arm that draws a disabled control.
const READING =
  'disabled:opacity-100 disabled:bg-muted disabled:text-foreground disabled:cursor-default disabled:pointer-events-auto dark:disabled:bg-muted';

// The box carries no edge at rest, so a hover states the edge before the analyst reaches it. The
// `focus-visible` recipe is the kit's own, copied whole: `ring` alone paints `currentcolor`.
const WRITING =
  'hover:border-input focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

// The figures are not right-aligned. Alignment is for a column of figures, and the cells flow
// about 2.6 to a line, so a right edge would land at a different place on each cell, far from the
// name it belongs to. `tabular-nums` still holds the digits on one width.
const FIGURES = 'font-mono tabular-nums';

// `appearance-none` takes the paint of the browser away, so every colour of the box comes from a
// token. It also removes the grey a browser gives a disabled checkbox, which is not opacity and
// which `disabled:opacity-100` cannot reach.
const TICK_BOX = 'inline-flex h-6 shrink-0 items-center';
const TICK =
  'size-3.5 shrink-0 appearance-none rounded-none border border-input bg-muted checked:border-foreground checked:bg-foreground';
const TICK_READING = 'disabled:opacity-100 disabled:cursor-default disabled:pointer-events-auto';
const TICK_WRITING = 'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50';

const SENTENCE = 'block text-small/4 text-label';

function ReadOnlyField({ label, value }: { label: string; value: ClaimValue }) {
  switch (value.control) {
    case 'boolean':
      return (
        <span className={cn(TICK_BOX)}>
          <input
            type="checkbox"
            checked={value.checked}
            readOnly
            disabled
            aria-label={label}
            title={value.text}
            data-reading={UNFADED}
            className={cn(TICK, TICK_READING)}
          />
        </span>
      );
    case 'number':
      return (
        // A native number field prints in the locale of the machine, so this box shows `32,26`
        // on one machine and `32.26` on another. A surface that must print a decimal point takes
        // a text box, and the digits keep the figures class.
        <Input
          type="text"
          // The surface writes nothing, so the value is a default and never a bound
          // value with no handler.
          defaultValue={value.text}
          disabled
          aria-label={label}
          title={value.text}
          data-reading={UNFADED}
          className={cn(BOX, READING, FIGURES)}
        />
      );
    case 'date':
      return (
        <Input
          type="date"
          defaultValue={value.text}
          disabled
          aria-label={label}
          title={value.text}
          data-reading={UNFADED}
          className={cn(BOX, READING, FIGURES)}
        />
      );
    case 'text':
    case 'note':
    case 'list':
      // A list is already joined into the one text of the value, and no control splits it here.
      return (
        <Input
          type="text"
          defaultValue={value.text}
          disabled
          aria-label={label}
          title={value.text}
          data-reading={UNFADED}
          className={cn(BOX, READING)}
        />
      );
  }
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
      className={cn(
        BOX,
        WRITING,
        value.control === 'number' || value.control === 'date' ? FIGURES : '',
      )}
    />
  );
}

export function Field(props: FieldProps) {
  const said = useId();

  if (props.mode === 'reading') {
    return (
      <span className="block">
        <ReadOnlyField label={props.label} value={props.value} />
        {props.note === null ? null : <span className={cn(SENTENCE)}>{props.note}</span>}
      </span>
    );
  }

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
