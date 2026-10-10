import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { FIXTURE_RELEASE } from './fixture-release.ts';
import { VesselPage } from './vessel-page.tsx';

const OWNS = '0a1f0000-0000-4000-8000-000000000011';
const OLD_OWNS = '0a1f0000-0000-4000-8000-000000000014';
const ABSORBED = '0a1f0000-0000-4000-8000-000000000005';

const meta = {
  component: VesselPage,
  args: { release: FIXTURE_RELEASE.off, imo: '9000001' },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof VesselPage>;

export default meta;

type Story = StoryObj<typeof meta>;

const itemOf = (canvasElement: HTMLElement, claimId: string): HTMLElement => {
  const link = canvasElement.querySelector(`li a[href$="claim/${claimId}/index.html"]`);
  const item = link?.closest('li');
  if (!(item instanceof HTMLElement)) throw new Error(`no item links to the claim ${claimId}`);
  return item;
};

export const AClosedRelationGivesBothDatesAndTheClaimOfItsEnd: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('heading', { name: 'IMO 9000001' })).toBeVisible();
    const item = itemOf(canvasElement, OLD_OWNS);
    await expect(item).toHaveTextContent('From 01/06/2019, to 01/03/2024.');
    await expect(
      canvas.getByRole('link', { name: /^End date: Baltic Tanker Holding owns/u }),
    ).toBeVisible();
  },
};

export const AnOpenRelationShowsAsOpenAndNeverAsEnded: Story = {
  play: async ({ canvas, canvasElement }) => {
    const item = itemOf(canvasElement, OWNS);
    await expect(item).toHaveTextContent('From 01/03/2024, open: the release gives no end date.');
    await expect(item).not.toHaveTextContent('08/11/2026');
    await expect(
      canvas.getByText('Start unknown. End open: the release gives no end date.'),
    ).toBeVisible();
  },
};

export const ARenamedVesselGivesItsFormerName: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Former names' })).toBeVisible();
    await expect(canvas.getByText('Volna Star')).toBeVisible();
  },
};

export const AMergedVesselNamesTheAbsorbedIdentifier: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: ABSORBED })).toBeVisible();
  },
};

export const TwoVesselsWithOneNumberAndNoMergeShareThePage: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText(/^2 vessels of the release carry this IMO number/u),
    ).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Severnaya Volna' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Northern Wave' })).toBeVisible();
  },
};

export const TheDrawingHoldsTheDatedMarksAndTheVersionLine: Story = {
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector('[data-timeline]');
    await expect(figure).not.toBeNull();
    await expect(figure).toHaveTextContent('Version 08/11/2026');
    await expect(figure?.querySelectorAll('a').length).toBeGreaterThan(0);
  },
};

export const WithThePairOffNoMarkShowsAPair: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-nato-pair]')).toBeNull();
  },
};

export const WithThePairOnEachMarkShowsItsPair: Story = {
  args: { release: FIXTURE_RELEASE.on },
  play: async ({ canvasElement }) => {
    await expect(itemOf(canvasElement, OWNS)).toHaveTextContent('NATO C3');
  },
};
