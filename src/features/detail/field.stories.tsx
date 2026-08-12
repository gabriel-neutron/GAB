import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import type { Attribute, Attributes, AttributeValue } from '@/shared/fixtures/types';
import { cn } from '@/shared/lib/utils';

import { readClaims } from './claims';
import { Field } from './field';

/**
 * The check of step 1 of `docs/detail-surface.md` §8: the four types are legible at full value
 * in both themes, and no value is truncated. §4.2 is the contract.
 *
 * **Every row below is invented**, as `src/shared/fixtures/corpus.ts` says of its own rows, and
 * it lives in this file alone. The story calls `readClaims`, which is what the caller of `Field`
 * calls, so both change on the day `src/contract/` replaces the fixtures.
 *
 * Each assertion reads a role, an accessible name, a value or an attribute. A class name and a
 * colour are the interior of the component, and they change with the theme.
 */

const claim = (v: AttributeValue): Attribute => ({ v, src: ['doc-probe'] });

/** One of each type of the probe: a yes-or-no, a number, a date, a text and a list. */
const PROBE: Attributes = {
  crew_certified: claim(true),
  gross_tonnage: claim(32567),
  delivered_on: claim('2019-04-17'),
  imo_number: claim('9482137'),
  former_names: claim(['Aurora Bay', 'Cape Ferro', 'Nordic Trader']),
};

/** §3.7: the five-digit tonnage that a spinner truncated, and a text longer than one cell. */
const LONG_TEXT =
  'Hull survey of 2024 reports pitting in way of the number three cargo hold, port side.';

const TRUNCATION: Attributes = {
  gross_tonnage: claim(32567),
  condition_note: claim(LONG_TEXT),
};

const FORMER_NAMES = 'Aurora Bay, Cape Ferro, Nordic Trader';

/**
 * §4.1 gives a cell its width from its value: a short value takes 17 rem, and a value longer
 * than 34 characters takes the whole line. The stories state the width they measure in.
 */
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

/**
 * §3.4, stated as a story can reach it.
 *
 * **The defect this replaces:** the stories asserted `toHaveValue` and the `title` attribute.
 * Both read the DOM, and both pass while the paint is clipped, so the story could not fail on
 * the very defect §3.4 records. A disabled shadcn input loses half its opacity and draws the
 * value at about 3.3:1. The computed opacity of a read-only control on this surface is `1`.
 *
 * **The contrast ratio itself is `no story can reach this`.** A ratio needs the two colours and
 * a measurement. The measured ladder in the head of `src/index.css` states each one, and a
 * `visual-qa` pass on the live surface proves the paint.
 */
const expectFullOpacity = async (control: HTMLElement): Promise<void> => {
  await expect(control).toBeDisabled();
  await expect(getComputedStyle(control).opacity).toBe('1');
};

/**
 * §3.7 truncation is **geometry**, and this is the assertion that reads it.
 *
 * A control whose content is wider than its own box draws part of the value outside that box,
 * and the browser clips it. `scrollWidth` is the width of the content and `clientWidth` is the
 * width of the box, so a value that fits is a value that is not truncated.
 *
 * **The defect this replaces:** the stories asserted `toHaveValue`, the `title` attribute and
 * the computed opacity. All three read the DOM or a non-geometric style, and none of them read a
 * width, so no story of this surface could fail on a clipped value at all. §3.7 truncation is
 * geometric and it is not an opacity artefact.
 *
 * **What this assertion sees, measured.** A cell narrowed to 6 rem fails it with
 * `expected 455 to be less than or equal to 94`, so the assertion is live. **The room a spinner
 * reserves it does not see today**: §5.3 holds every control disabled, and Chromium draws no
 * spin button on a disabled input, so the room is zero in this browser. `NO_SPINNER` stays in
 * `./field` for the enabled surface #42 will build, and a person must still look at Firefox,
 * which reads neither `-webkit-` rule.
 */
const expectNothingIsClipped = async (control: HTMLElement): Promise<void> => {
  await expect(control.scrollWidth).toBeLessThanOrEqual(control.clientWidth);
};

/**
 * The assertions of §4.2, written once and run on both grounds. It is not exported, because a
 * named export of a CSF file is a story.
 *
 * **The fonts are awaited before the first geometry read.** `src/index.css` records that
 * `Roboto Condensed` and `JetBrains Mono` are not installed yet, so a measurement that did not
 * wait would flake on the day a `@fontsource` package lands.
 *
 * A checkbox holds no text value, so the full word of the value is asserted where the component
 * draws it, under `title`. Every other control carries the whole value.
 */
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

  // §4.2: a list is joined into the one box, and every member of it stays readable.
  const names = canvas.getByLabelText('Former names');
  await expect(names).toHaveValue(FORMER_NAMES);
  await expectNothingIsClipped(names);
  await expectFullOpacity(names);
};

/** §4.2, and §5.3: every control is disabled, and every value is at its full contrast. */
export const EveryControlIsLegibleAtItsFullValue: Story = {
  render: () => fields(PROBE),
  play: expectEveryValue,
};

/**
 * §3.4 on the dark ground: every read-only control keeps its full opacity there too. There is no
 * theme decorator in `.storybook/preview.ts`, so the story sets `.dark` itself.
 *
 * **The defect this name replaces:** the story ran assertions identical to the light one, so it
 * proved that the component mounts under `.dark` and nothing about the paint. The name now says
 * what it proves. **The contrast ratio itself is `no story can reach this`**: the measured ladder
 * in the head of `src/index.css` states each ratio on its own ground, and a `visual-qa` pass
 * proves the live paint.
 */
export const NoValueLosesItsOpacityOnTheDarkGround: Story = {
  render: () => <div className="dark bg-background p-2 text-foreground">{fields(PROBE)}</div>,
  play: expectEveryValue,
};

/**
 * §3.7. A number field reserved room for a spinner it never showed, and that room truncated a
 * five-digit tonnage to three digits. The value carries every character, and so does a text
 * longer than its cell.
 *
 * **The fonts are awaited first.** `src/index.css` records that `Roboto Condensed` and
 * `JetBrains Mono` are not installed yet, so a measurement that did not wait would flake on the
 * day a `@fontsource` package lands.
 *
 * §4.1 gives a value longer than 34 characters the whole line, so the note is measured on a line
 * and not in a 17 rem cell.
 */
export const NoValueIsTruncated: Story = {
  render: () => fields(TRUNCATION, 'w-[46rem]'),
  play: async ({ canvas }) => {
    await document.fonts.ready;

    const tonnage = canvas.getByLabelText('Gross tonnage');
    await expect(tonnage).toHaveValue(32567);
    await expect(tonnage).toHaveAttribute('title', '32567');
    // §3.7: the spinner room clips the figure and leaves the value in the DOM. Only the
    // geometry sees that.
    await expectNothingIsClipped(tonnage);
    // §3.4: a value that is drawn at half opacity is unreadable, and the assertions above pass
    // through it. This one does not.
    await expectFullOpacity(tonnage);

    const note = canvas.getByLabelText('Condition note');
    await expect(note).toHaveValue(LONG_TEXT);
    await expect(note).toHaveAttribute('title', LONG_TEXT);
    await expectNothingIsClipped(note);
    await expectFullOpacity(note);
  },
};
