import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { SiteFooter } from './site-footer';

const meta = {
  component: SiteFooter,
  args: {
    note: {
      version: '1.0',
      date: '2026-11-08',
      reportError: 'https://example.org/report-an-error',
      rightOfReply: 'mailto:reply@example.org',
    },
    readAt: new Date('2026-11-08T10:05:00Z'),
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

export const SaysWhenTheRecordWasReadAndThatTheCountsChange: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Record read at 2026-11-08 10:05 UTC')).toBeVisible();
    await expect(
      canvas.getByText('The counts follow the record and change after each review.'),
    ).toBeVisible();
  },
};

/** The service answers: no version, no licence line and no contact link. */
export const NamesNoVersionWhenTheServiceAnswers: Story = {
  args: { note: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/^Record read at/u)).toBeVisible();
    await expect(canvas.queryByText(/^Version/u)).toBeNull();
    await expect(canvas.queryByRole('link')).toBeNull();
  },
};
