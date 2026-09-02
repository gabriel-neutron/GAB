import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { useState } from 'react';

import type {
  Attribute,
  Attributes,
  AttributeDeclaration,
  AttributeValue,
  Vocabulary,
} from '@/shared/read/model';
import { cn } from '@/shared/lib/utils';

import { readClaims, typedValue, type ClaimValue, type TypedValue } from './claims';
import type { ClaimDraft } from './draft';
import { readEntry } from './entry';
import { Field, type FieldProps } from './field';

// Each assertion reads a role, an accessible name, a value or an attribute. A class name and a
// colour are the interior of the component, and they change with the theme.

const claim = (v: AttributeValue): Attribute => ({ v, src: ['doc-probe'] });

const PROBE: Attributes = {
  crew_certified: claim(true),
  gross_tonnage: claim(32567),
  delivered_on: claim('2019-04-17'),
  imo_number: claim('9482137'),
  former_names: claim(['Aurora Bay', 'Cape Ferro', 'Nordic Trader']),
};

const LONG_TEXT =
  'Hull survey of 2024 reports pitting in way of the number three cargo hold, port side.';

const TRUNCATION: Attributes = {
  gross_tonnage: claim(32567),
  condition_note: claim(LONG_TEXT),
};

const FORMER_NAMES = 'Aurora Bay, Cape Ferro, Nordic Trader';

// A cell takes its width from its value: a short value takes 17 rem, and a value longer than 34
// characters takes the whole line.
const fields = (attrs: Attributes, width = 'w-80') => (
  <div className={cn('flex flex-col gap-1', width)}>
    {/* No key of this probe is declared, so each control draws the shape of its value. */}
    {readClaims(attrs, NO_VOCABULARY).map((row) => (
      <Field key={row.key} mode="reading" label={row.label} value={row.value} note={null} />
    ))}
  </div>
);

const NO_VOCABULARY: Vocabulary = [];

const declared = (
  key: string,
  kind: AttributeDeclaration['kind'],
  pattern: string | null = null,
): AttributeDeclaration => ({ key, kind, label: key, unit: null, pattern, retired: false });

const onTyped = fn();

const UNDECLARED = 'The vocabulary declares no such key, and it takes no value here.';

const QUANTITY = declared('coal_stock_t', 'quantity');
const FLAG = declared('seasonal_closure', 'boolean');
const IDENTIFIER = declared('imo', 'identifier', '^[0-9]{7}$');

/** One writable control, with the state a page holds for it. A story drives what a page drives. */
function OneField({
  declaration,
  start,
  onTyped,
}: {
  declaration: AttributeDeclaration;
  start: ClaimValue;
  onTyped: (typed: TypedValue) => void;
}) {
  const [draft, setDraft] = useState<ClaimDraft>({ value: start, refusal: null });

  return (
    <div className="w-80 p-2">
      <Field
        mode="writing"
        label={declaration.key}
        draft={draft}
        onEdit={(typed) => {
          onTyped(typed);
          const read = readEntry(declaration, typed);
          setDraft({
            value: typedValue(start.control, typed),
            refusal: read.held ? null : read.refusal,
          });
        }}
      />
    </div>
  );
}

/** The arm the args of this file state. A story of the other arm renders it, and takes no args. */
type Reading = Extract<FieldProps, { mode: 'reading' }>;

/** One arm of the union is not the other, so a story states the arm it draws. */
const READING: Reading = {
  mode: 'reading',
  label: 'Gross tonnage',
  value: { control: 'number', text: '32567' },
  note: null,
};

const WRITING: Extract<FieldProps, { mode: 'writing' }> = {
  mode: 'writing',
  label: 'Coal stock',
  draft: { value: { control: 'number', text: '41200' }, refusal: null },
  onEdit: () => undefined,
};

const meta = {
  component: Field,
  args: READING,
} satisfies Meta<Reading>;

export default meta;

type Story = StoryObj<typeof meta>;

type PlayContext = Parameters<NonNullable<Story['play']>>[0];

// A disabled shadcn input loses half its opacity and draws the value at about 3.3:1. The
// read-only arm beats that fade and says so in a word, and a contrast ratio is out of the reach
// of a story: it needs the two colours and a measurement.
const expectUnfaded = async (control: HTMLElement): Promise<void> => {
  await expect(control).toBeDisabled();
  await expect(control).toHaveAttribute('data-reading', 'unfaded');
};

// A control whose content is wider than its box draws part of the value outside it, and the
// browser clips it. `scrollWidth` is the content and `clientWidth` is the box. A cell narrowed to
// 6 rem fails with `expected 455 to be less than or equal to 94`, so the assertion is live.
const expectNothingIsClipped = async (control: HTMLElement): Promise<void> => {
  await expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth);
};

// The fonts are awaited before the first geometry read: `Roboto Condensed` and `JetBrains Mono`
// are not installed yet, so a measurement that did not wait would flake. A checkbox holds no text
// value, so the whole word is asserted under `title`.
const expectEveryValue = async ({ canvas }: PlayContext): Promise<void> => {
  await document.fonts.ready;

  const tick = canvas.getByLabelText('Crew certified');
  await expect(tick).toBeChecked();
  await expect(tick).toHaveAttribute('title', 'yes');
  await expectUnfaded(tick);

  const tonnage = canvas.getByLabelText('Gross tonnage');
  await expect(tonnage).toHaveValue('32567');
  await expectNothingIsClipped(tonnage);
  await expectUnfaded(tonnage);

  const delivered = canvas.getByLabelText('Delivered on');
  await expect(delivered).toHaveValue('2019-04-17');
  await expectNothingIsClipped(delivered);
  await expectUnfaded(delivered);

  const imo = canvas.getByLabelText('Imo number');
  await expect(imo).toHaveValue('9482137');
  await expectNothingIsClipped(imo);
  await expectUnfaded(imo);

  const names = canvas.getByLabelText('Former names');
  await expect(names).toHaveValue(FORMER_NAMES);
  await expectNothingIsClipped(names);
  await expectUnfaded(names);
};

export const EveryControlIsLegibleAtItsFullValue: Story = {
  args: READING,
  render: () => fields(PROBE),
  play: expectEveryValue,
};

// There is no theme decorator in `.storybook/preview.ts`, so the story sets `.dark` itself.
export const NoValueLosesItsOpacityOnTheDarkGround: Story = {
  args: READING,
  render: () => <div className="dark bg-background p-2 text-foreground">{fields(PROBE)}</div>,
  play: expectEveryValue,
};

// The fonts are awaited first: `Roboto Condensed` and `JetBrains Mono` are not installed yet, so
// a measurement that did not wait would flake. A value longer than 34 characters takes the whole
// line, so the note is measured on a line and not in a 17 rem cell.
export const NoValueIsTruncated: Story = {
  args: READING,
  render: () => fields(TRUNCATION, 'w-[46rem]'),
  play: async ({ canvas }) => {
    await document.fonts.ready;

    const tonnage = canvas.getByLabelText('Gross tonnage');
    await expect(tonnage).toHaveValue('32567');
    await expect(tonnage).toHaveAttribute('title', '32567');
    await expectNothingIsClipped(tonnage);
    await expectUnfaded(tonnage);

    const note = canvas.getByLabelText('Condition note');
    await expect(note).toHaveValue(LONG_TEXT);
    await expect(note).toHaveAttribute('title', LONG_TEXT);
    await expectNothingIsClipped(note);
    await expectUnfaded(note);
  },
};

export const ATypedValueReachesTheHandler: Story = {
  args: WRITING,
  render: () => (
    <OneField
      declaration={IDENTIFIER}
      start={{ control: 'text', text: '9482137' }}
      onTyped={onTyped}
    />
  ),
  play: async ({ canvas }) => {
    onTyped.mockClear();
    const box = canvas.getByLabelText('imo');
    await userEvent.clear(box);
    await userEvent.type(box, '9482138');

    await expect(onTyped).toHaveBeenLastCalledWith('9482138');
    await expect(box).toHaveValue('9482138');
    await expect(box).toHaveAttribute('aria-invalid', 'false');
  },
};

export const ANumberRefusesALocaleComma: Story = {
  args: WRITING,
  render: () => (
    <OneField
      declaration={QUANTITY}
      start={{ control: 'number', text: '41200' }}
      onTyped={onTyped}
    />
  ),
  play: async ({ canvas }) => {
    const box = canvas.getByLabelText('coal_stock_t');
    // A native number control drops a comma before a handler sees it. This box is a text box.
    await expect(box).toHaveAttribute('type', 'text');
    await expect(box).toHaveAttribute('inputmode', 'decimal');

    await userEvent.clear(box);
    await userEvent.type(box, '43,5');

    await expect(box).toHaveValue('43,5');
    await expect(box).toHaveAttribute('aria-invalid', 'true');
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Write the number with a decimal point. A comma is not a decimal point here.',
    );
  },
};

export const ACheckboxEmitsItsBoolean: Story = {
  args: WRITING,
  render: () => (
    <OneField
      declaration={FLAG}
      start={{ control: 'boolean', checked: false, text: 'no' }}
      onTyped={onTyped}
    />
  ),
  play: async ({ canvas }) => {
    onTyped.mockClear();
    const tick = canvas.getByLabelText('seasonal_closure');
    await expect(tick).not.toBeChecked();

    await userEvent.click(tick);
    await expect(onTyped).toHaveBeenLastCalledWith(true);
    await expect(tick).toBeChecked();

    await userEvent.click(tick);
    await expect(onTyped).toHaveBeenLastCalledWith(false);
  },
};

// A key the vocabulary does not declare cannot be written: the database refuses it. The screen
// says so in words, and it never leaves the reader to read that out of a grey box.
export const AnUndeclaredKeyIsReadOnlyAndSaysWhy: Story = {
  args: READING,
  render: () => (
    <div className="w-80 p-2">
      <Field
        mode="reading"
        label="Berth count"
        value={{ control: 'number', text: '4' }}
        note={UNDECLARED}
      />
    </div>
  ),
  play: async ({ canvas }) => {
    const box = canvas.getByLabelText('Berth count');
    await expect(box).toBeDisabled();
    await expect(canvas.getByText(UNDECLARED)).toBeInTheDocument();
  },
};
