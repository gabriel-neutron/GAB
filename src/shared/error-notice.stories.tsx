import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { ErrorNotice } from '@/shared/error-notice';

const RAW = 'invalid_type at "entity.start": expected string, received null';

const meta = {
  title: 'Shared/ErrorNotice',
  component: ErrorNotice,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ErrorNotice>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainMessageAndRetry: Story = {
  args: { detail: RAW, onRetry: fn() },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText(/could not load/)).toBeInTheDocument();
    await expect(canvas.queryByText(/start/i, { ignore: 'pre' })).not.toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Retry' }));
    await expect(args.onRetry).toHaveBeenCalledOnce();
  },
};

export const RawTextOnlyAfterOpening: Story = {
  args: { detail: RAW, onRetry: fn() },
  play: async ({ canvas }) => {
    const summary = canvas.getByText('Technical detail');
    await expect(summary.closest('details')).not.toHaveAttribute('open');
    await userEvent.click(summary);
    await expect(summary.closest('details')).toHaveAttribute('open');
    await expect(canvas.getByText(RAW)).toBeVisible();
  },
};
