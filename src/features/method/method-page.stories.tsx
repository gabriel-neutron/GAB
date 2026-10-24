import type { Meta, StoryObj } from '@storybook/react-vite';
import { coverageOf } from '@gab/release/coverage';
import type { SiteManifest } from '@gab/release/site-manifest';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

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
  coverage: coverageOf(['vessel', 'vessel', 'company'], 2),
  files: [],
};

const meta = {
  component: MethodPage,
  args: { manifest: MANIFEST },
  parameters: { layout: 'fullscreen' },
  // The glossary link needs a router, so the story gives the page a root route of its own.
  render: (args) => (
    <div className="h-svh">
      <RouterProvider
        router={createRouter({
          routeTree: createRootRoute({ component: () => <MethodPage {...args} /> }),
          history: createMemoryHistory({ initialEntries: ['/'] }),
        })}
      />
    </div>
  ),
} satisfies Meta<typeof MethodPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GivesTheVisibleTitleTheFactsAndTheScope: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'About' })).toBeVisible();
    await expect(canvas.getByText('2026-11-08')).toBeVisible();
    await expect(canvas.getByText('Entities')).toBeVisible();
    await expect(canvas.getByText(/not yet in the record/u)).toBeVisible();
    await expect(canvas.getByText(/^By type: 2 /u)).toBeVisible();
  },
};

export const GivesEachSectionAnAnchorInTheList: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 1, name: 'About' });
    const list = canvas.getByRole('navigation', { name: 'On this page' });
    for (const title of [
      'What the dataset is',
      'What the labels mean',
      'Report an error',
      'Licence and citation',
    ]) {
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible();
      await expect(within(list).getByRole('link', { name: title })).toHaveAttribute(
        'href',
        expect.stringMatching(/^#/u),
      );
    }
  },
};

export const GivesTheLabelsOfTheDisclaimerAndLinksToTheGlossary: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 1, name: 'About' });
    await expect(canvas.getByText('Proposed — not checked:')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'glossary' })).toHaveAttribute(
      'href',
      '/glossary',
    );
  },
};

export const ShowsTheContactAddressesWithoutMailto: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 1, name: 'About' });
    await expect(canvas.getByRole('link', { name: 'reply@example.org' })).toHaveAttribute(
      'href',
      'mailto:reply@example.org',
    );
    await expect(canvas.queryByText(/mailto:/u)).toBeNull();
    await expect(
      canvas.getByRole('link', { name: 'https://example.org/report-an-error' }),
    ).toBeVisible();
  },
};

export const GivesTheLicencesAndTheCitationLineOfTheRelease: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { level: 1, name: 'About' });
    await expect(canvas.getByText(/The dataset is under CC-BY 4\.0/u)).toBeVisible();
    await expect(
      canvas.getByText('GAB dataset, release 1.0, 2026-11-08. https://gab.example.org/'),
    ).toBeVisible();
  },
};

export const SaysSoWhenTheSiteHoldsNoRelease: Story = {
  args: { manifest: null },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1, name: 'About' })).toBeVisible();
    await expect(canvas.getByText(/holds no release/u)).toBeVisible();
  },
};
