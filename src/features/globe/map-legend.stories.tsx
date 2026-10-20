import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { MapLegend } from './map-legend';

const meta = {
  component: MapLegend,
  parameters: { layout: 'padded' },
  render: () => (
    <div className="dark w-full max-w-3xl border border-border bg-background text-foreground">
      <MapLegend />
    </div>
  ),
} satisfies Meta<typeof MapLegend>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheLegendNamesEachStageAndEachLookOfALine: Story = {
  play: async ({ canvas }) => {
    const points = within(canvas.getByRole('list', { name: 'Points' }));
    await expect(points.getByText('Refining and liquefaction')).toBeVisible();
    await expect(points.getByText('No stage')).toBeVisible();
    const lines = within(canvas.getByRole('list', { name: 'Lines' }));
    await expect(lines.getAllByRole('listitem')).toHaveLength(6);
    await expect(lines.getByText('Link in review, not a fact')).toBeVisible();
  },
};

export const TheLegendSaysThatNoPositionIsBorrowed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/draws no borrowed position/)).toBeVisible();
  },
};
