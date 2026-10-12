import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { DownloadsPage } from './downloads-page.tsx';
import { FIXTURE_RELEASE } from './fixture-release.ts';

const meta = {
  component: DownloadsPage,
  args: { release: FIXTURE_RELEASE.off },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DownloadsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EachFileHasItsChecksumAndLicence: Story = {
  play: async ({ canvas }) => {
    for (const file of FIXTURE_RELEASE.off.manifest.files) {
      await expect(canvas.getByRole('link', { name: file.path })).toHaveAttribute(
        'href',
        `../${file.path}`,
      );
      await expect(canvas.getByText(file.sha256)).toBeVisible();
    }
  },
};

export const TheChangelogGivesItsSummaryAndItsFile: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText(/Changes since the version of 01\/10\/2026 \(0\.9\)\./u),
    ).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'Download the changelog (changelog.csv)' }),
    ).toHaveAttribute('href', '../changelog.csv');
  },
};
