import type { Meta, StoryObj } from '@storybook/react-vite';
import type { SiteManifest } from '@gab/release/site-manifest';
import { expect } from 'storybook/test';

import { MethodPage } from './method-page';

const COUNTS = { added: 0, changed: 0, removed: 0, merged: 0, unmerged: 0 };

const MANIFEST: SiteManifest = {
  version: '1.0',
  date: '2026-11-08',
  showNatoPair: false,
  dateRules: { eu: 'entry_into_force', ofac: 'recent_actions_notice', uk: 'date_designated' },
  disclaimer:
    '**About this data.** A machine reads public documents and proposes each claim.\n\n- **Proposed — not checked:** a candidate.\n\nReport an error: https://example.org/report-an-error. Right of reply: mailto:reply@example.org.',
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
  nameCandidates: { proposed: 3, confirmed: 2, refused: 1 },
  files: [],
};

const meta = {
  component: MethodPage,
  args: { manifest: MANIFEST },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-svh">
      <MethodPage {...args} />
    </div>
  ),
} satisfies Meta<typeof MethodPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GivesTheDisclaimerAndEachSectionOfTheMethod: Story = {
  play: async ({ canvas }) => {
    for (const title of [
      'About this data and the labels',
      'The rating method',
      'Licences',
      'Sanctions on the map',
      'The critical nodes',
      'One name in two scripts',
      'Permanent addresses',
    ])
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'mailto:reply@example.org' })).toBeVisible();
  },
};

export const GivesTheDateRulesOfTheRelease: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Date rules of this release/u)).toBeVisible();
  },
};

export const SaysWhenTheReleaseGivesNoDateRules: Story = {
  args: { manifest: { ...MANIFEST, dateRules: null } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/This release does not give its date rules/u)).toBeVisible();
  },
};

export const CountsTheMergeCandidatesOfTheRelease: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('Candidates at this release: 3 waiting, 2 confirmed, 1 refused.'),
    ).toBeVisible();
  },
};

export const ExplainsTheNatoPairOnlyWhenTheReleaseShowsIt: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('This release does not show the rating of a claim.'),
    ).toBeVisible();
    await expect(canvas.queryByText(/STANAG 2511/u)).toBeNull();
  },
};

export const ExplainsTheNatoPairWhenTheReleaseShowsIt: Story = {
  args: { manifest: { ...MANIFEST, showNatoPair: true } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/STANAG 2511/u)).toBeVisible();
  },
};

export const SaysSoWhenTheSiteHoldsNoRelease: Story = {
  args: { manifest: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/holds no release/u)).toBeVisible();
  },
};
