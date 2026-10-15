import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import countries from './countries.json?raw';
import { chainView } from './chain-card.ts';
import { chainFlows } from './chain-flows.ts';
import { FIXTURE_RELEASE } from './fixture-release.ts';
import { MapPage } from './map-page.tsx';
import { outsideRussia } from './outside-russia.ts';

const release = FIXTURE_RELEASE.chain;
const view = chainView(release);

// The story renders the page without the map script, so no live canvas starts. The built site
// runs the script.
const meta = {
  component: MapPage,
  args: {
    release,
    view,
    flows: chainFlows(release, view.stages, outsideRussia(countries)),
  },
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
      '1 of them are in review',
    );
    await expect(canvas.getByRole('list', { name: 'Product chains' })).toHaveTextContent(
      'Gas and LNG: 0 links',
    );
  },
};
