import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { SITE, QUIET_SITE } from '@gab/release/event-fixture';
import { EntityPage } from './entity-page.tsx';
import { FIXTURE_RELEASE } from './fixture-release.ts';

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';

const meta = {
  component: EntityPage,
  args: { release: FIXTURE_RELEASE.off, entityId: VESSEL },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof EntityPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AnEntityGivesItsValuesRelationsAndSources: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Severnaya Volna' })).toBeVisible();
    await expect(canvas.getByText('9000001')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Arctic Bridge Shipping' })).toBeVisible();
    await expect(canvas.getAllByText('is owned by')).toHaveLength(2);
    await expect(canvas.getByRole('link', { name: 'IMO 9000001' })).toBeVisible();
    await expect(canvas.getByText('Council Implementing Regulation (EU) 2025/0000')).toBeVisible();
  },
};

export const AMergedIdentifierIsNamed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('0a1f0000-0000-4000-8000-000000000005')).toBeVisible();
  },
};

export const WithThePairOffNoClaimShowsAPair: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-nato-pair]')).toBeNull();
  },
};

export const WithThePairOnEachClaimShowsItsPair: Story = {
  args: { release: FIXTURE_RELEASE.on },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('NATO A2')).toBeVisible();
  },
};

export const ASiteGivesItsEventsAndTheLimitOfTheCount: Story = {
  args: { release: FIXTURE_RELEASE.events, entityId: SITE },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Events' })).toBeVisible();
    await expect(canvas.getByText('At least 2 claimed and stored strikes.')).toBeVisible();
    await expect(canvas.getByText(/It is not a count of all strikes/u)).toBeVisible();
    await expect(canvas.getByText('“у ніч на 15 травня”')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Unmanned Systems Forces' })).toBeVisible();
  },
};

export const AStoredCounterStatementShowsAndItsAbsenceIsSaid: Story = {
  args: { release: FIXTURE_RELEASE.events, entityId: SITE },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No strike took place at the terminal')).toBeVisible();
    await expect(canvas.getAllByText(/no counter-statement stored/u)[0]).toBeVisible();
  },
};

export const ASiteWithNoStoredEventReadsAtLeastZero: Story = {
  args: { release: FIXTURE_RELEASE.events, entityId: QUIET_SITE },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('At least 0 claimed and stored strikes.')).toBeVisible();
  },
};
