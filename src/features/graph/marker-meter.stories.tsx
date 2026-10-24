import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { MarkerMeter } from './marker-meter';

const meta = {
  component: MarkerMeter,
  args: { drawn: 1000, hidden: 312 },
  decorators: [
    (Story) => (
      <div className="relative h-16 w-80 bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof MarkerMeter>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The meter shows how many markers the cap leaves out. */
export const ShowsTheMarkersTheCapLeavesOut: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('img', { name: 'Markers: 1000 drawn, 312 not drawn' }),
    ).toBeVisible();
    await expect(canvas.getByText('+312')).toBeVisible();
  },
};

/** Under the cap, the meter is absent. */
export const IsAbsentUnderTheCap: Story = {
  args: { drawn: 40, hidden: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('img')).toBeNull();
  },
};
