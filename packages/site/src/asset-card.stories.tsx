import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { AssetCard } from './asset-card.tsx';
import { chainView } from './chain-card.ts';
import { SITE } from './event-fixture.ts';
import { FIXTURE_RELEASE } from './fixture-release.ts';

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const PORT = '0a1f0000-0000-4000-8000-000000000004';

const cardOf = (release: typeof FIXTURE_RELEASE.off, id: string) => {
  const card = chainView(release).cards[id];
  if (card === undefined) throw new Error(`the fixture has no card for ${id}`);
  return card;
};

const meta = {
  component: AssetCard,
  args: { card: cardOf(FIXTURE_RELEASE.events, SITE), stage: 'export' },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof AssetCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AFacilityGivesTheStatusOfEachRegimeOrNoListing: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Sanctions' })).toBeVisible();
    await expect(
      canvas.getByText(
        /Listing \(asset freeze\), act: Council of the European Union, Council Implementing Regulation \(EU\) 2025\/0000, from/u,
      ),
    ).toBeVisible();
    await expect(canvas.getByText('2025-05-20')).toBeVisible();
    await expect(canvas.getByText('No listing.')).toBeVisible();
  },
};

export const EachStrikeGivesItsDaysAndTheDocumentThatReportsIt: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Strikes' })).toBeVisible();
    await expect(canvas.getByText('2026-03-02')).toBeVisible();
    await expect(canvas.getByText('2026-05-14 to 2026-05-15')).toBeVisible();
    await expect(canvas.getAllByText(/reported by A report of news/u)).toHaveLength(2);
  },
};

export const AFactInReviewCarriesTheWordsAndNeverTheFormOfAFact: Story = {
  play: async ({ canvas }) => {
    const [accepted, inReview] = within(
      canvas.getByRole('heading', { name: 'Strikes' }).parentElement ?? document.body,
    ).getAllByRole('listitem');
    await expect(accepted).not.toHaveTextContent('In review');
    await expect(inReview).toHaveTextContent(/^In review/u);
    await expect(inReview).toHaveAttribute('title', 'Proposed — not checked');
    const measure = canvas.getByText(/Sectoral measure/u);
    await expect(measure).toHaveTextContent(/^In review/u);
  },
};

export const AnAcceptedEntityGivesItsAcceptedRelationsFirst: Story = {
  args: { card: cardOf(FIXTURE_RELEASE.off, VESSEL), stage: null },
  play: async ({ canvas }) => {
    const items = within(
      canvas.getByRole('heading', { name: 'Relations' }).parentElement ?? document.body,
    ).getAllByRole('listitem');
    await expect(items[0]).not.toHaveTextContent('In review');
    await expect(items.at(-1)).toHaveTextContent(/^In review/u);
    await expect(canvas.queryByRole('heading', { name: 'Sanctions' })).toBeNull();
  },
};

export const AProposedEntityMarksEachOfItsFactsInReview: Story = {
  args: { card: cardOf(FIXTURE_RELEASE.off, PORT), stage: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/each fact below is in review/u)).toBeVisible();
    for (const item of canvas.getAllByRole('listitem'))
      await expect(item).toHaveTextContent(/^In review/u);
  },
};

const SITE_CARD = cardOf(FIXTURE_RELEASE.events, SITE);

export const AStrikeWithNoDayLeavesTheDayBlank: Story = {
  args: {
    card: { ...SITE_CARD, strikes: SITE_CARD.strikes.map((one) => ({ ...one, days: '' })) },
    stage: 'export',
  },
  play: async ({ canvas }) => {
    const items = within(
      canvas.getByRole('heading', { name: 'Strikes' }).parentElement ?? document.body,
    ).getAllByRole('listitem');
    await expect(items[0]).toHaveTextContent(/^Reported by A report of news\.$/u);
    await expect(canvas.queryByText(/No day stored/u)).toBeNull();
  },
};
