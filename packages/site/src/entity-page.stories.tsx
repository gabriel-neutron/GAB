import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

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
    await expect(canvas.getByText('is owned by')).toBeVisible();
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
