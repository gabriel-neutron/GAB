import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { ScreenQueryField, ScreenQueryProvider, useScreenQuery } from '@/shared/screen-query';

const NAMED = [
  'Tartus',
  'Port Said',
  'Port Sudan',
  'Port Louis',
  'Port Klang',
  'Port Hedland',
  'Port Elizabeth',
  'Port Moresby',
  'Port Blair',
  'Port Vila',
].map((label, index) => ({ id: `e${String(index)}`, label }));

function OfferingScreen({ choose }: { choose: (id: string) => void }) {
  useScreenQuery({ named: NAMED, choose });
  return null;
}

function FieldOnAScreen({ choose }: { choose: (id: string) => void }) {
  return (
    <ScreenQueryProvider path="/story">
      <OfferingScreen choose={choose} />
      <ScreenQueryField />
    </ScreenQueryProvider>
  );
}

const meta = {
  component: FieldOnAScreen,
  args: { choose: fn() },
} satisfies Meta<typeof FieldOnAScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AnEmptyFieldListsNoName: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('combobox'));
    await expect(canvas.queryByRole('listbox')).toBeNull();
  },
};

export const EightNamesShowAndTheRestAreCounted: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole('combobox'), 'port');
    await expect(canvas.getAllByRole('option')).toHaveLength(8);
    await expect(canvas.getByText('1 more name matches.')).toBeVisible();
  },
};

export const AChoiceSelectsTheNameAndClosesTheList: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.type(canvas.getByRole('combobox'), 'sudan');
    await userEvent.click(canvas.getByRole('option', { name: 'Port Sudan' }));
    await expect(args.choose).toHaveBeenCalledWith('e2');
    await expect(canvas.queryByRole('listbox')).toBeNull();
    await expect(canvas.getByRole('combobox')).toHaveFocus();
  },
};

export const TheKeyboardChoosesARow: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.type(canvas.getByRole('combobox'), 'port');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Enter}');
    await expect(args.choose).toHaveBeenCalledWith('e2');
    await expect(canvas.queryByRole('listbox')).toBeNull();
  },
};

export const EscapeClosesTheListAndKeepsTheText: Story = {
  play: async ({ canvas }) => {
    const field = canvas.getByRole('combobox');
    await userEvent.type(field, 'port');
    await userEvent.keyboard('{Escape}');
    await expect(canvas.queryByRole('listbox')).toBeNull();
    await expect(field).toHaveValue('port');
  },
};
