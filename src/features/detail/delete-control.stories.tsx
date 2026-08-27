import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { DeleteControl } from './delete-control';

const NAME = 'MV Northern Ledger';

const onDelete = fn();

const meta = {
  component: DeleteControl,
  args: { name: NAME, busy: false, onDelete },
} satisfies Meta<typeof DeleteControl>;

export default meta;

type Story = StoryObj<typeof meta>;

// Deleting evidence on a mis-click is not recoverable through any door.
export const OneClickDestroysNothing: Story = {
  play: async ({ canvas }) => {
    onDelete.mockClear();
    await userEvent.click(canvas.getByRole('button', { name: `Delete ${NAME}` }));
    await expect(onDelete).not.toHaveBeenCalled();
  },
};

export const TheQuestionNamesWhatIsDestroyed: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: `Delete ${NAME}` }));
    await expect(canvas.getByText(`Delete ${NAME}? No door brings it back.`)).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: `Confirm the deletion of ${NAME}` }),
    ).toBeEnabled();
  },
};

export const TheSecondClickDeletesOnce: Story = {
  play: async ({ canvas }) => {
    onDelete.mockClear();
    await userEvent.click(canvas.getByRole('button', { name: `Delete ${NAME}` }));
    await userEvent.click(canvas.getByRole('button', { name: `Confirm the deletion of ${NAME}` }));
    await expect(onDelete).toHaveBeenCalledTimes(1);
    await expect(canvas.getByRole('button', { name: `Delete ${NAME}` })).toBeVisible();
  },
};

export const KeepingItDestroysNothing: Story = {
  play: async ({ canvas }) => {
    onDelete.mockClear();
    await userEvent.click(canvas.getByRole('button', { name: `Delete ${NAME}` }));
    await userEvent.click(canvas.getByRole('button', { name: `Keep ${NAME}` }));
    await expect(onDelete).not.toHaveBeenCalled();
    await expect(canvas.getByRole('button', { name: `Delete ${NAME}` })).toBeVisible();
  },
};

export const AnActInFlightTakesNoClick: Story = {
  args: { busy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: `Delete ${NAME}` })).toBeDisabled();
  },
};
