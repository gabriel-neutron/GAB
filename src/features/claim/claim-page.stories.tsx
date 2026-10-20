import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { ClaimPage } from './claim-page';
import { FIXTURE_RELEASE } from './fixture-release';

const meta = {
  component: ClaimPage,
  args: {
    release: FIXTURE_RELEASE.off,
    claimId: '0a1f0000-0000-4000-8000-000000000001/imo',
    entityHref: (id: string) => `/entity/${id}`,
    claimHref: (id: string) => `/claim/${id}`,
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-svh">
      <ClaimPage {...args} />
    </div>
  ),
} satisfies Meta<typeof ClaimPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AClaimGivesItsExcerptAndItsSource: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('SEVERNAYA VOLNA, IMO 9000001')).toBeVisible();
    await expect(
      canvas.getByRole('link', { name: 'https://eur-lex.europa.eu/eli/reg_impl/2025/0000/oj' }),
    ).toBeVisible();
    await expect(canvas.getByText('2026-09-30')).toBeVisible();
    await expect(canvas.getByText(/Page 4/u)).toBeVisible();
    await userEvent.click(canvas.getByText('Licence and permanent address'));
    await expect(canvas.getByText('CC-BY 4.0')).toBeVisible();
  },
};

export const ARelationClaimGivesBothEndsAndItsDays: Story = {
  args: { claimId: '0a1f0000-0000-4000-8000-000000000011' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Arctic Bridge Shipping' })).toHaveAttribute(
      'href',
      '/entity/0a1f0000-0000-4000-8000-000000000002',
    );
    await expect(canvas.getByRole('link', { name: 'Severnaya Volna' })).toBeVisible();
    await expect(canvas.getByText('2024-03-01')).toBeVisible();
  },
};

export const AnIdentifierWithASlashKeepsItsFolders: Story = {
  args: { claimId: '0a1f0000-0000-4000-8000-000000000014/valid_to' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: /Baltic Tanker Holding owns/u })).toHaveAttribute(
      'href',
      '/claim/0a1f0000-0000-4000-8000-000000000014',
    );
  },
};

export const ADocumentWithNoPassageSaysSo: Story = {
  args: { claimId: '0a1f0000-0000-4000-8000-000000000013' },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('The release holds no passage of this document for this claim.'),
    ).toBeVisible();
  },
};

export const WithThePairOnTheClaimShowsItsPair: Story = {
  args: { release: FIXTURE_RELEASE.on },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Rating')).toBeVisible();
    await expect(canvas.getByText('A2')).toBeVisible();
    await expect(
      canvas.getByRole('img', {
        name: /Admiralty A2. Author: completely reliable. Fact: probably true/u,
      }),
    ).toBeVisible();
  },
};

export const AReleaseThatHidesThePairShowsNoRatingAndNoLegend: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('Rating')).toBeNull();
    await expect(canvas.queryByRole('img', { name: /Admiralty/u })).toBeNull();
  },
};

export const AnUnknownClaimShowsNotFound: Story = {
  args: { claimId: 'no-such-claim' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'Claim not found' })).toBeVisible();
  },
};

export const SaysSoWhenTheSiteHoldsNoRelease: Story = {
  args: { release: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/holds no release/u)).toBeVisible();
  },
};
