import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { Rail, type RailRows, type RailTypeRow } from '@/shared/rail';

// Each assertion reads a role, an accessible name, an `aria-` or `data-` attribute, or the text.
// No story reads a class and none reads a colour.

const row = (over: Partial<RailTypeRow> & { readonly type: string }): RailTypeRow => ({
  initial: over.type.slice(0, 1).toUpperCase(),
  count: 12,
  on: true,
  open: false,
  stateWord: 'on',
  name: `${over.type}, 12 on the map`,
  colour: null,
  ...over,
});

const rows = (over: Partial<RailRows> = {}): RailRows => ({
  types: [row({ type: 'vessel' }), row({ type: 'port', count: 7 })],
  openTypes: [],
  everyTypeOff: false,
  open: true,
  ...over,
});

const onAct = fn();

const meta = {
  component: Rail,
  args: {
    rows: rows(),
    onAct,
    index: (type: string) => <p data-index={type}>The index of {type}</p>,
  },
  // The width is part of the contract of each caller: 240px open, a 44px strip closed on the map.
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Rail>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One icon cannot say "hidden" on the map and "dimmed" on the graph, so words say the state. */
export const TheStateIsAnEyeForTheEyeAndWordsForTheReader: Story = {
  args: {
    rows: rows({
      types: [
        row({ type: 'vessel' }),
        row({ type: 'port', count: 7, on: false, stateWord: 'off, dimmed' }),
      ],
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    const eyes = canvasElement.querySelectorAll('svg[aria-hidden="true"].lucide-eye');
    const shut = canvasElement.querySelectorAll('svg[aria-hidden="true"].lucide-eye-off');
    await expect(eyes).toHaveLength(1);
    await expect(shut).toHaveLength(1);

    // The words the caller wrote are what a reader hears, and they are surface-specific.
    await expect(canvas.getByRole('button', { pressed: false })).toHaveTextContent('off, dimmed');
    await expect(canvas.getByRole('button', { pressed: true })).toHaveTextContent('on');
  },
};

/** A line through the text says the state to a reader who sees it, and to nobody else. */
export const ATypeSwitchesOffAndTheCountSaysSo: Story = {
  args: {
    rows: rows({
      types: [
        row({ type: 'vessel' }),
        row({ type: 'port', count: 7, on: false, stateWord: 'off, dimmed' }),
      ],
    }),
  },
  play: async ({ canvas, args }) => {
    const off = canvas.getByRole('button', { pressed: false });
    await expect(off).toHaveTextContent('port');
    await expect(off).toHaveTextContent('7');
    await expect(off).toHaveTextContent('off, dimmed');

    await userEvent.click(off);
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'switch-type', type: 'port', on: true });
  },
};

/** A control that conflates the two acts switches a type off when the analyst looks inside it. */
export const TheFoldAndTheSwitchAreTwoActs: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open the vessel list' }));
    await expect(args.onAct).toHaveBeenCalledWith({
      kind: 'open-type',
      type: 'vessel',
      open: true,
    });

    const [onRow] = canvas.getAllByRole('button', { pressed: true });
    if (onRow === undefined) throw new Error('The rail draws no type row that is on');
    await userEvent.click(onRow);
    await expect(args.onAct).toHaveBeenCalledWith({
      kind: 'switch-type',
      type: 'vessel',
      on: false,
    });
  },
};

/** A closed row that names its region sends a reader to an element that is not in the tree. */
export const AnUnfoldedTypeCarriesItsOwnIndex: Story = {
  args: {
    rows: rows({
      types: [row({ type: 'vessel', open: true }), row({ type: 'port', count: 7 })],
      openTypes: ['vessel'],
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    const open = canvas.getByRole('button', { name: 'Close the vessel list' });
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await expect(open).toHaveAttribute('aria-controls', 'rail-index-vessel');

    const closed = canvas.getByRole('button', { name: 'Open the port list' });
    await expect(closed).toHaveAttribute('aria-expanded', 'false');
    await expect(closed).not.toHaveAttribute('aria-controls');

    await expect(canvasElement.querySelectorAll('[data-index]')).toHaveLength(1);
    await expect(canvasElement.querySelector('input')).toBeNull();
  },
};

export const MoreThanOneTypeStandsUnfolded: Story = {
  args: {
    rows: rows({
      types: [row({ type: 'vessel', open: true }), row({ type: 'port', count: 7, open: true })],
      openTypes: ['vessel', 'port'],
    }),
  },
  play: async ({ canvas, canvasElement, args }) => {
    const drawn = canvasElement.querySelectorAll('[data-index]');
    await expect(drawn).toHaveLength(2);
    await expect(canvasElement.querySelector('[data-index="vessel"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-index="port"]')).not.toBeNull();

    await userEvent.click(canvas.getByRole('button', { name: 'Close the port list' }));
    await expect(args.onAct).toHaveBeenCalledWith({
      kind: 'open-type',
      type: 'port',
      open: false,
    });
  },
};

/** The filter is stored, so a screen with every type off survives a reload. */
export const AControlThatExcludesEverythingCarriesTheWayBack: Story = {
  args: {
    rows: rows({
      types: [
        row({ type: 'vessel', on: false, stateWord: 'off' }),
        row({ type: 'port', count: 7, on: false, stateWord: 'off' }),
      ],
      everyTypeOff: true,
    }),
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText(/Every type is off/)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Switch every type on' }));
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'show-every-type' });
  },
};

/** A sentence does not fit in the 44px strip, so the number stays and the name says the words. */
export const TheFoldedRailStillSaysWhatIsDrawn: Story = {
  args: {
    rows: rows({
      types: [
        row({ type: 'vessel' }),
        row({ type: 'port', count: 7, on: false, name: 'port, 7 off the map' }),
      ],
      open: false,
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    const off = canvas.getByRole('button', { name: 'port, 7 off the map' });
    await expect(off).toHaveAttribute('aria-pressed', 'false');
    await expect(off).toHaveTextContent('7');

    await expect(canvas.getByRole('button', { name: 'Open the rail' })).toBeVisible();
    await expect(canvasElement.querySelector('[data-index]')).toBeNull();
  },
};

export const TheRailReportsItsOwnFold: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Close the rail' }));
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'open-rail', open: false });
  },
};

/** A type that is off draws nothing, so a list of it would name entities that no canvas shows. */
export const ATypeThatIsOffCarriesNoIndex: Story = {
  args: {
    rows: rows({
      types: [row({ type: 'vessel', open: true, on: false, stateWord: 'off' })],
      openTypes: ['vessel'],
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-index]')).toBeNull();
    await expect(canvasElement.querySelector('#rail-index-vessel')).toBeNull();
  },
};
