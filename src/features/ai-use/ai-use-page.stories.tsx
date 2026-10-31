import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SiteManifest } from '@gab/release/site-manifest';
import { expect } from 'storybook/test';

import { AiUsePage } from './ai-use-page';

const COUNTS = { added: 0, changed: 0, removed: 0, merged: 0, unmerged: 0 };

const MANIFEST: SiteManifest = {
  version: '1.0',
  date: '2026-11-08',
  showNatoPair: false,
  dateRules: null,
  disclaimer: 'About this data.',
  contacts: {
    reportError: 'https://example.org/report-an-error',
    rightOfReply: 'mailto:reply@example.org',
  },
  iriBase: 'https://gab.example.org/',
  changelog: {
    path: 'changelog.csv',
    previous: null,
    entities: COUNTS,
    relations: COUNTS,
    claims: COUNTS,
  },
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  coverage: null,
  files: [],
};

const meta = {
  component: AiUsePage,
  args: { manifest: MANIFEST },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-svh">
      <AiUsePage {...args} />
    </div>
  ),
} satisfies Meta<typeof AiUsePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GivesThePolicyTheCitationTheLimitsAndTheContacts: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'AI use' })).toBeVisible();
    for (const title of ['What you may do', 'How to cite a claim', 'Limits', 'Contact'])
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible();
    await expect(canvas.getByText(/GAB dataset, release 1.0, 2026-11-08/u)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'reply@example.org' })).toHaveAttribute(
      'href',
      'mailto:reply@example.org',
    );
  },
};

export const GivesNoContactAndNoCitationWhenTheSiteHoldsNoRelease: Story = {
  args: { manifest: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Limits' })).toBeVisible();
    await expect(canvas.queryByRole('heading', { name: 'Contact' })).toBeNull();
  },
};
