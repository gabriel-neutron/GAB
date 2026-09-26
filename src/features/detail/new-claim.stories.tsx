import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { ATTRIBUTE_KEY_LENGTH } from '@gab/proposal/attribute-value';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { readDossier, type RecordRow } from './dossier';
import { NewClaim } from './new-claim';

/** MV Northern Ledger, the entity the address names. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const read = (): readonly RecordRow[] => {
  const held = readDossier(corpus, VESSEL, entityTypes);
  if (held === null) throw new Error('The committed corpus holds no MV Northern Ledger');
  return held.rows;
};

const ROWS = read();

/** A key the entity already holds, which the record corrects and this control refuses. */
const STANDING = ROWS[0]?.claim.key ?? '';

const onMint = fn();

const ADD = 'Add the claim';

const meta = {
  component: NewClaim,
  args: { rows: ROWS, busy: false, onMint },
  parameters: { layout: 'fullscreen' },
  // Two boxes and a button stand on one row, so the width is fixed at 900px.
  render: (args) => (
    <div className="w-[900px] p-2">
      <NewClaim {...args} />
    </div>
  ),
} satisfies Meta<typeof NewClaim>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ABlankFormMintsNothing: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: ADD })).toBeDisabled();
    await expect(canvas.getByText('Write a key and a value.')).toBeVisible();
  },
};

// `attrs_valid` holds the same rule in the record, so the screen says it first and in words.
export const AKeyIsLowerSnakeCase: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Key'), 'Coal Stock');
    await expect(canvas.getByText(/A key is lower case words/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: ADD })).toBeDisabled();
  },
};

export const AKeyTheEntityHoldsIsCorrectedAndNotMinted: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Key'), STANDING);
    await userEvent.type(canvas.getByLabelText('Value'), 'Kotka');
    await expect(canvas.getByText(/This entity holds that key/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: ADD })).toBeDisabled();
  },
};

// M9: a value is never blank. The unknown is the absence of the key, and not an empty box.
export const AKeyWithNoValueMintsNothing: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Key'), 'last_port_call');
    await expect(canvas.getByText('Write the value of the claim.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: ADD })).toBeDisabled();
  },
};

// Nothing declares a kind (M11), so the kind is read from the text and the analyst reads which
// one it took. A number keeps no trailing zero, so the sentence states that loss as well.
export const TheKindIsReadFromTheText: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Key'), 'coal_stock_t');
    await userEvent.type(canvas.getByLabelText('Value'), '41.5');
    await expect(canvas.getByText(/A number drops a trailing zero/)).toBeVisible();

    await userEvent.clear(canvas.getByLabelText('Value'));
    await userEvent.type(canvas.getByLabelText('Value'), '2026-03-09');
    await expect(canvas.getByText(/a day of the calendar/)).toBeVisible();

    await userEvent.clear(canvas.getByLabelText('Value'));
    await userEvent.type(canvas.getByLabelText('Value'), 'yes');
    await expect(canvas.getByText(/a yes or a no/)).toBeVisible();
  },
};

// A day the calendar does not hold is not a day, so it stays text and it is stored. The record
// draws it as text too, because `shapeOf` counts the calendar before it names a day control.
export const ADayTheCalendarDoesNotHoldStaysText: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Key'), 'keel_laid');
    await userEvent.type(canvas.getByLabelText('Value'), '2019-02-30');
    await expect(canvas.getByText(/The value reads as text/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: ADD })).toBeEnabled();
  },
};

// A comma is one text and never two values. The kind reader names no list, and the sentence
// says so. The same text, typed into a claim that holds a list, splits into two values.
export const ACommaMakesNoList: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Key'), 'port_calls');
    await userEvent.type(canvas.getByLabelText('Value'), 'Rotterdam, Hamburg');
    await expect(canvas.getByText(/A comma makes no list here/)).toBeVisible();
  },
};

// `attrs_valid` holds the same limit in the record, so the screen states it in words first.
export const AKeyLongerThanTheRecordTakesIsRefused: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Key'), `a${'b'.repeat(ATTRIBUTE_KEY_LENGTH)}`);
    await expect(canvas.getByText('A key is 63 characters at most.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: ADD })).toBeDisabled();
  },
};

// A number is a double, so the act carries `41.5` for the `41.50` that was typed. The sentence
// states that loss, and this gesture measures it in the act itself.
export const ANumberDropsATrailingZero: Story = {
  play: async ({ canvas }) => {
    onMint.mockClear();
    await userEvent.type(canvas.getByLabelText('Key'), 'coal_stock_t');
    await userEvent.type(canvas.getByLabelText('Value'), '41.50');
    await userEvent.click(canvas.getByRole('button', { name: ADD }));
    await expect(onMint).toHaveBeenCalledWith({ coal_stock_t: { v: 41.5 } });
  },
};

// A number of 310 digits or more is Infinity, which the door refuses with `Invalid input`. The
// screen says it first, and the act never leaves the browser.
export const ANumberTheBrowserCannotHoldIsRefused: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Key'), 'crew_aboard');
    await userEvent.type(canvas.getByLabelText('Value'), `1${'0'.repeat(400)}`);
    await expect(canvas.getByText(/cannot hold a number of that many digits/)).toBeVisible();
    await expect(canvas.getByRole('button', { name: ADD })).toBeDisabled();
  },
};

// M8: the writer adds `manual` to the key, and a minted claim cites nothing else. It rests on
// the authority of the operator alone, and the sentence says so before the act leaves.
export const AReadyClaimSendsOneActSignedManual: Story = {
  play: async ({ canvas }) => {
    onMint.mockClear();
    await userEvent.type(canvas.getByLabelText('Key'), 'last_port_call');
    await userEvent.type(canvas.getByLabelText('Value'), 'Kotka');
    await expect(canvas.getByText(/It will be signed manual/)).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: ADD }));
    await expect(onMint).toHaveBeenCalledWith({ last_port_call: { v: 'Kotka' } });
  },
};

// One act at a time. A second act written while one is in flight goes to a record the first
// act has already moved.
export const AnActInFlightTakesNoEntry: Story = {
  args: { busy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Key')).toBeDisabled();
    await expect(canvas.getByLabelText('Value')).toBeDisabled();
    await expect(canvas.getByRole('button', { name: ADD })).toBeDisabled();
  },
};
