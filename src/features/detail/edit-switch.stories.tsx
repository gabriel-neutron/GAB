import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { EditSwitch } from './edit-switch';

const onSwitch = fn();

const meta = {
  component: EditSwitch,
  args: { view: 'reading', busy: false, onSwitch },
  beforeEach: () => {
    onSwitch.mockClear();
  },
} satisfies Meta<typeof EditSwitch>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheReadingViewAsksForTheWritingView: Story = {
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Edit' });
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(button);
    await expect(onSwitch).toHaveBeenCalledWith('writing');
  },
};

export const TheWritingViewAsksForTheReadingView: Story = {
  args: { view: 'writing' },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Edit' });
    await expect(button).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(button);
    await expect(onSwitch).toHaveBeenCalledWith('reading');
  },
};

export const AnActInFlightTakesNoSwitch: Story = {
  args: { view: 'writing', busy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeDisabled();
  },
};
