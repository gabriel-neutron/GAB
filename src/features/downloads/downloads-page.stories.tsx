import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SiteManifest } from '@gab/release/site-manifest';
import { expect } from 'storybook/test';

import { DownloadsPage } from './downloads-page';

const COUNTS = { added: 8, changed: 0, removed: 0, merged: 0, unmerged: 0 };

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
    previous: { version: '0.9', date: '2026-10-01' },
    entities: COUNTS,
    relations: COUNTS,
    claims: COUNTS,
  },
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  files: [
    {
      path: 'entities.csv',
      bytes: 2924,
      sha256: '0a640be68fe2a3503365dbbdb989da65bae9a806f1400818c26735c02bce9881',
    },
    {
      path: 'claims.csv',
      bytes: 9404,
      sha256: '767d4d40624209dc6d1354a90a1156c1ee06f8041c0cb9212f71f9e69144a794',
    },
    {
      path: 'changelog.csv',
      bytes: 3961,
      sha256: '04b6e8b5da4875dccb9353e2078132a742156119d5d512708039dd1dbef49bba',
    },
  ],
};

const meta = {
  component: DownloadsPage,
  args: { manifest: MANIFEST, fileHref: (path: string) => `/release/${path}` },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-svh">
      <DownloadsPage {...args} />
    </div>
  ),
} satisfies Meta<typeof DownloadsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LinksEachFileOfTheReleaseWithItsChecksum: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'entities.csv' })).toHaveAttribute(
      'href',
      '/release/entities.csv',
    );
    await expect(canvas.getByRole('link', { name: 'manifest.json' })).toHaveAttribute(
      'href',
      '/release/manifest.json',
    );
    await expect(
      canvas.getByText('0a640be68fe2a3503365dbbdb989da65bae9a806f1400818c26735c02bce9881'),
    ).toBeVisible();
    await expect(canvas.getByText('From the release of 08/11/2026')).toBeVisible();
  },
};

export const GivesTheChangelogSummaryAndItsLink: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText(/Changes since the version of 01\/10\/2026 \(0\.9\)/u),
    ).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'Download the changelog (changelog.csv)' }),
    ).toHaveAttribute('href', '/release/changelog.csv');
    await expect(
      canvas.getByRole('table', { name: 'Changes since the previous release' }),
    ).toBeVisible();
  },
};

export const SaysSoWhenTheSiteHoldsNoRelease: Story = {
  args: { manifest: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/holds no release/u)).toBeVisible();
  },
};
