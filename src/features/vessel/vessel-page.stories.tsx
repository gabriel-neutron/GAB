import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { FIXTURE_RELEASE } from './fixture-release';
import { VesselPage } from './vessel-page';

const ABSORBED = '0a1f0000-0000-4000-8000-000000000005';
const VESSEL = '0a1f0000-0000-4000-8000-000000000001';

const meta = {
  component: VesselPage,
  args: {
    release: FIXTURE_RELEASE.off,
    imo: '9000001',
    entityHref: (id: string) => `/entity/${id}`,
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-svh">
      <VesselPage {...args} />
    </div>
  ),
} satisfies Meta<typeof VesselPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NamesTheIMOAndTheVersionOfTheRelease: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1, name: 'IMO 9000001' })).toBeVisible();
    await expect(canvas.getByText('From the release of 08/11/2026')).toBeVisible();
  },
};

export const AClosedRelationGivesBothDates: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('From 01/06/2019, to 01/03/2024.')).toBeVisible();
  },
};

export const AnOpenRelationShowsAsOpenAndNeverAsEnded: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('From 01/03/2024, open: the release gives no end date.'),
    ).toBeVisible();
    await expect(
      canvas.getByText('Start unknown. End open: the release gives no end date.'),
    ).toBeVisible();
  },
};

export const ARenamedVesselGivesItsFormerName: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 3, name: 'Former names' })).toBeVisible();
    await expect(canvas.getByText('Volna Star')).toBeVisible();
  },
};

export const AMergedVesselNamesTheAbsorbedIdentifier: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: ABSORBED })).toHaveAttribute(
      'href',
      `/entity/${ABSORBED}`,
    );
  },
};

export const TwoVesselsWithOneNumberAndNoMergeShareThePage: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText(/^2 vessels of the release carry this IMO number/u),
    ).toBeVisible();
    await expect(canvas.getByRole('heading', { level: 2, name: 'Severnaya Volna' })).toBeVisible();
    await expect(canvas.getByRole('heading', { level: 2, name: 'Northern Wave' })).toBeVisible();
  },
};

export const EachVesselLinksItsEntityPage: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('link', { name: 'Severnaya Volna' })[0]).toHaveAttribute(
      'href',
      `/entity/${VESSEL}`,
    );
  },
};

export const TheDrawingHoldsTheDatedMarksAndTheVersionLine: Story = {
  play: async ({ canvasElement }) => {
    const figure = canvasElement.querySelector('[data-timeline]');
    await expect(figure).not.toBeNull();
    await expect(figure).toHaveTextContent('Version 08/11/2026');
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
    await expect(canvasElement.querySelector('[data-nato-pair]')).not.toBeNull();
  },
};

export const TheVesselFinderLinkIsExternalAndSaysItIsNotASource: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: /VesselFinder/u });
    await expect(link).toHaveAttribute(
      'href',
      'https://www.vesselfinder.com/vessels/details/9000001',
    );
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await expect(canvas.getByText(/pas une source GAB/u)).toBeVisible();
  },
};

export const SaysSoWhenTheSiteHoldsNoRelease: Story = {
  args: { release: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/holds no release/u)).toBeVisible();
  },
};

export const SaysSoWhenTheReleaseHoldsNoVesselWithTheNumber: Story = {
  args: { imo: '9999999' },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('The release holds no vessel with the IMO number 9999999.'),
    ).toBeVisible();
  },
};
