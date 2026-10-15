import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import countries from './countries.json?raw';
import { chainView } from './chain-card.ts';
import { CHAIN } from './chain-fixture.ts';
import { chainFlows } from './chain-flows.ts';
import { SITE } from './event-fixture.ts';
import { FIXTURE_RELEASE } from './fixture-release.ts';
import { CARDS_ELEMENT } from './map-elements.ts';
import { MapPage } from './map-page.tsx';
import { outsideRussia } from './outside-russia.ts';
import type { SiteRelease } from './site-release.ts';

const argsOf = (release: SiteRelease) => {
  const view = chainView(release);
  return { release, view, flows: chainFlows(release, view.stages, outsideRussia(countries)) };
};

// The story renders the page without the map script, so no live canvas starts. The built site
// runs the script.
const meta = {
  component: MapPage,
  args: argsOf(FIXTURE_RELEASE.chain),
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MapPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EachEntityWithAPositionIsListed: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('region', { name: 'Map of the entities with a position' }),
    ).toBeVisible();
    await expect(
      canvas.getByText(/11 entities of this release have their own position/u),
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Primorsk' })).toHaveAttribute(
      'href',
      '../entity/0a1f0000-0000-4000-8000-000000000004/index.html',
    );
  },
};

export const TheStripCountsEachOfTheSixStages: Story = {
  play: async ({ canvas }) => {
    const strip = canvas.getByRole('list', { name: 'Stages of the chain' });
    await expect(strip).toHaveTextContent('Fields: 1');
    await expect(strip).toHaveTextContent('Upstream transport: 1');
    await expect(strip).toHaveTextContent('Refining and liquefaction: 1');
    await expect(strip).toHaveTextContent('Export: 2');
    await expect(strip).toHaveTextContent('Exit from Russian control: 4');
    await expect(strip).toHaveTextContent('Declared destination: 2');
  },
};

export const TheFilterOffersEachProductChain: Story = {
  play: async ({ canvas }) => {
    const filter = canvas.getByRole('group', { name: 'Product chain' });
    await expect(filter).toHaveTextContent('All');
    await expect(canvas.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    for (const name of ['Crude oil', 'Refined products', 'Gas and LNG'])
      await expect(canvas.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
  },
};

export const ALinkInReviewIsCountedAndNamedSo: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/7 physical links join two assets/u)).toHaveTextContent(
      '1 of them is in review',
    );
    await expect(canvas.getByText(/exit point is in review/u)).toHaveTextContent(
      '1 exit point is in review.',
    );
    await expect(canvas.getByRole('list', { name: 'Product chains' })).toHaveTextContent(
      'Gas and LNG: 0 links',
    );
  },
};

export const ThePageHoldsTheCardOfEachEntityForTheMapScript: Story = {
  args: argsOf(FIXTURE_RELEASE.events),
  play: async ({ canvasElement }) => {
    const holder = canvasElement.querySelector(`#${CARDS_ELEMENT}`);
    await expect(holder).not.toBeVisible();
    await expect(holder?.querySelectorAll('[data-card]')).toHaveLength(3);
    await expect(holder?.querySelector(`[data-card="${SITE}"]`)).toHaveTextContent(
      /Strikes.*reported by A report of news/u,
    );
  },
};

export const ACardGivesTheStageThatTheStripAndTheTableGive: Story = {
  play: async ({ canvas, canvasElement }) => {
    const card = canvasElement.querySelector(`[data-card="${CHAIN.REFINERY_ABROAD}"]`);
    await expect(card).toHaveTextContent('facility, Declared destination');
    const row = canvas.getByRole('link', { name: 'Test refinery abroad' }).closest('tr');
    await expect(row).toHaveTextContent('Declared destination');
  },
};
