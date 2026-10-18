import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import countries from '@gab/proposal/countries.json?raw';
import { chainView } from './chain-card.ts';
import { CHAIN } from './chain-fixture.ts';
import { chainFlows } from './chain-flows.ts';
import { SITE } from './event-fixture.ts';
import { FIXTURE_RELEASE } from './fixture-release.ts';
import { CARDS_ELEMENT } from './map-elements.ts';
import { MapPage } from './map-page.tsx';
import { outsideRussia } from '@gab/proposal/outside-russia';
import type { SiteRelease } from '@gab/release/site-release';

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
      canvas.getByText(
        /12 entities of this release have their own position, and 8 physical links/u,
      ),
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Primorsk' })).toHaveAttribute(
      'href',
      '../entity/0a1f0000-0000-4000-8000-000000000004/index.html',
    );
  },
};

export const TheStripGivesTheSixStepsOfTheChainWithTheirCounts: Story = {
  play: async ({ canvas }) => {
    const strip = canvas.getByRole('list', { name: 'Steps of the chain' });
    await expect(strip).toHaveTextContent('Extraction: 1');
    await expect(strip).toHaveTextContent('Pipeline: 4');
    await expect(strip).toHaveTextContent('Refinery: 1');
    await expect(strip).toHaveTextContent('Terminal: 2');
    await expect(strip).toHaveTextContent('Export: 2');
    await expect(strip).toHaveTextContent('Exit: 4');
    await expect(canvas.getByRole('button', { name: 'Play the chain' })).toBeVisible();
    // The reader can stop the pulse, the spin and the camera flight.
    await expect(canvas.getByRole('button', { name: 'Stop motion' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  },
};

export const TheLongTextIsInAPanelThatTheReaderOpens: Story = {
  play: async ({ canvas, canvasElement }) => {
    const panel = canvasElement.querySelector('details');
    await expect(panel).not.toHaveAttribute('open');
    await expect(canvas.getByText('How to read this map')).toBeVisible();
    await expect(canvas.getByText(/A volume is an aggregate of the research/u)).not.toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Method page', hidden: true })).toHaveAttribute(
      'href',
      '../method/index.html',
    );
    await expect(
      canvas.getByRole('list', { name: 'Stages of the chain', hidden: true }),
    ).toHaveTextContent('Declared destination: 2');
  },
};

export const ThePageSaysSoWhenTheBrowserCannotDrawTheMap: Story = {
  play: async ({ canvas }) => {
    // The map script shows this line when the browser has no WebGL.
    const line = canvas.getByText(/This browser cannot draw the map, because it has no WebGL/u);
    await expect(line).not.toBeVisible();
    await expect(line).toHaveTextContent('The list of the entities is below the map.');
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
    await expect(canvas.getByText(/physical links are in review/u)).toHaveTextContent(
      '2 physical links are in review',
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
    await expect(holder?.querySelectorAll('[data-card]')).toHaveLength(4);
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
