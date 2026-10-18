import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, restoreAllMocks } from 'storybook/test';

import { holdWriter } from './hold-writer';
import { NotAvailable } from './not-available';
import { WhenWriterOnline } from './when-writer-online';

const meta = {
  component: WhenWriterOnline,
  args: { children: <button type="button">Create entity</button> },
  beforeEach: () => () => {
    restoreAllMocks();
  },
} satisfies Meta<typeof WhenWriterOnline>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AnOnlineWriterShowsTheEntry: Story = {
  beforeEach: async () => {
    await holdWriter(true);
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Create entity' })).toBeVisible();
  },
};

export const AnOfflineWriterHidesTheEntry: Story = {
  beforeEach: async () => {
    await holdWriter(false);
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('button', { name: 'Create entity' })).toBeNull();
  },
};

export const TheReviewPageOfflineStatesItAndOffersTheMap: Story = {
  render: () => <NotAvailable />,
  play: async ({ canvas }) => {
    await expect(canvas.getByText('This part is not available here.')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Go to the map' })).toHaveAttribute(
      'href',
      '/map',
    );
  },
};
