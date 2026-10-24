import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { MapLegend } from './map-legend';

const meta = {
  component: MapLegend,
  parameters: { layout: 'padded' },
  render: () => (
    <div className="w-full max-w-3xl border border-border bg-background text-foreground">
      <MapLegend />
    </div>
  ),
} satisfies Meta<typeof MapLegend>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheLegendNamesEachStage: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Refining and liquefaction')).toBeVisible();
    await expect(canvas.getByText('No stage')).toBeVisible();
  },
};
