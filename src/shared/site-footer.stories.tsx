import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { SiteFooter } from './site-footer';

const meta = {
  component: SiteFooter,
  args: {
    note: {
      date: '2026-11-08',
      reportError: 'https://example.org/report-an-error',
      rightOfReply: 'mailto:reply@example.org',
    },
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteFooter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NamesTheVersionAndGivesTheTwoContacts: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Version of 08/11/2026')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Report an error' })).toHaveAttribute(
      'href',
      'https://example.org/report-an-error',
    );
    await expect(canvas.getByRole('link', { name: 'Right of reply' })).toHaveAttribute(
      'href',
      'mailto:reply@example.org',
    );
  },
};

export const StatesTheLicenceOfTheDataset: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('The dataset is under CC-BY 4.0. Each row gives its own licence.'),
    ).toBeVisible();
  },
};

export const NeverSaysTheDataIsLive: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/live/iu)).toBeNull();
  },
};
