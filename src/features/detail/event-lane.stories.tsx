import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { QUIET_SITE, SITE } from '@gab/release/event-fixture';

import { EventLane } from './event-lane';
import { EVENTS_RELEASE } from './fixture-release';
import { releaseFactsOf } from './release-facts';

const eventsOf = (id: string) => releaseFactsOf(EVENTS_RELEASE, id, 'facility', true).events ?? [];

const meta = {
  component: EventLane,
  args: { events: eventsOf(SITE) },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EventLane>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GivesTheCounterAsALowerBound: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 2, name: 'Events' })).toBeVisible();
    await expect(canvas.getByText('At least 2 claimed and stored strikes.')).toBeVisible();
    await expect(canvas.getByText(/not a count of all strikes/u)).toBeVisible();
  },
};

export const GivesTheKindTheWordsTheActorAndTheDocumentOfAnEvent: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('claimed attack')[0]).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Unmanned Systems Forces' })).toHaveAttribute(
      'href',
      '/entity/0a1f0000-0000-4000-8000-000000000040',
    );
    await expect(canvas.getAllByText('No actor stored.')[0]).toBeVisible();
  },
};

export const ASiteWithNoStoredEventReadsAtLeastZeroAndSaysSo: Story = {
  args: { events: eventsOf(QUIET_SITE) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No claimed strike is stored for this site.')).toBeVisible();
    await expect(canvas.getByText('The release holds no event for this site.')).toBeVisible();
  },
};
