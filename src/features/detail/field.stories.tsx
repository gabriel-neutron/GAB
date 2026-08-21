import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import type { Attribute, Attributes, AttributeValue } from '@/shared/fixtures/types';
import { cn } from '@/shared/lib/utils';

import { readClaims } from './claims';
import { Field } from './field';

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
    {readClaims(attrs).map((row) => (
      <Field key={row.key} label={row.label} value={row.value} />
    ))}
  </div>
);

const meta = {
  component: Field,
  args: { label: 'Gross tonnage', value: { control: 'number', text: '32567' } },
} satisfies Meta<typeof Field>;

export default meta;

type Story = StoryObj<typeof meta>;

type PlayContext = Parameters<NonNullable<Story['play']>>[0];

// A disabled shadcn input loses half its opacity and draws the value at about 3.3:1, so the
// computed opacity of a read-only control is asserted at `1`. A contrast ratio itself is out of
// the reach of a story: it needs the two colours and a measurement.
const expectFullOpacity = async (control: HTMLElement): Promise<void> => {
  await expect(control).toBeDisabled();
  await expect(getComputedStyle(control).opacity).toBe('1');
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
  await expectFullOpacity(tick);

  const tonnage = canvas.getByLabelText('Gross tonnage');
  await expect(tonnage).toHaveValue(32567);
  await expectNothingIsClipped(tonnage);
  await expectFullOpacity(tonnage);

  const delivered = canvas.getByLabelText('Delivered on');
  await expect(delivered).toHaveValue('2019-04-17');
  await expectNothingIsClipped(delivered);
  await expectFullOpacity(delivered);

  const imo = canvas.getByLabelText('Imo number');
  await expect(imo).toHaveValue('9482137');
  await expectNothingIsClipped(imo);
  await expectFullOpacity(imo);

  const names = canvas.getByLabelText('Former names');
  await expect(names).toHaveValue(FORMER_NAMES);
  await expectNothingIsClipped(names);
  await expectFullOpacity(names);
};

export const EveryControlIsLegibleAtItsFullValue: Story = {
  render: () => fields(PROBE),
  play: expectEveryValue,
};

// There is no theme decorator in `.storybook/preview.ts`, so the story sets `.dark` itself.
export const NoValueLosesItsOpacityOnTheDarkGround: Story = {
  render: () => <div className="dark bg-background p-2 text-foreground">{fields(PROBE)}</div>,
  play: expectEveryValue,
};

// The fonts are awaited first: `Roboto Condensed` and `JetBrains Mono` are not installed yet, so
// a measurement that did not wait would flake. A value longer than 34 characters takes the whole
// line, so the note is measured on a line and not in a 17 rem cell.
export const NoValueIsTruncated: Story = {
  render: () => fields(TRUNCATION, 'w-[46rem]'),
  play: async ({ canvas }) => {
    await document.fonts.ready;

    const tonnage = canvas.getByLabelText('Gross tonnage');
    await expect(tonnage).toHaveValue(32567);
    await expect(tonnage).toHaveAttribute('title', '32567');
    await expectNothingIsClipped(tonnage);
    await expectFullOpacity(tonnage);

    const note = canvas.getByLabelText('Condition note');
    await expect(note).toHaveValue(LONG_TEXT);
    await expect(note).toHaveAttribute('title', LONG_TEXT);
    await expectNothingIsClipped(note);
    await expectFullOpacity(note);
  },
};
