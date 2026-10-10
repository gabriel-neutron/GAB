import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { ClaimPage } from './claim-page.tsx';
import { FIXTURE_RELEASE } from './fixture-release.ts';

const meta = {
  component: ClaimPage,
  args: {
    release: FIXTURE_RELEASE.off,
    claimId: '0a1f0000-0000-4000-8000-000000000001/imo',
  },
  parameters: { layout: 'fullscreen' },
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
    await expect(canvas.getByText('CC-BY 4.0')).toBeVisible();
  },
};

export const ARelationClaimGivesBothEndsAndItsDays: Story = {
  args: { claimId: '0a1f0000-0000-4000-8000-000000000011' },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Arctic Bridge Shipping' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Severnaya Volna' })).toBeVisible();
    await expect(canvas.getByText('2024-03-01')).toBeVisible();
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
    await expect(canvas.getByText('NATO pair')).toBeVisible();
    await expect(canvas.getByText('NATO A2')).toBeVisible();
  },
};
