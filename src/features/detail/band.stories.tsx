import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { Band } from './band';

const meta = {
  component: Band,
  args: {
    name: 'Relations',
    count: 3,
    children: <p className="text-xs">Three lines of a list stand here.</p>,
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="w-[900px] p-2">
      <Band {...args} />
    </div>
  ),
} satisfies Meta<typeof Band>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ThePartIsNamedAndCounted: Story = {
  play: async ({ canvas }) => {
    const band = canvas.getByRole('region', { name: 'Relations' });
    await expect(within(band).getByRole('heading', { level: 2 })).toHaveTextContent('Relations');
    await expect(within(band).getByRole('heading', { level: 2 })).toHaveTextContent('3');
  },
};

/** An absence is never a fault, and a count of zero is written and never dropped. */
export const AnEmptyPartStillStatesItsCount: Story = {
  args: { count: 0, children: <p className="text-xs">0 relations, and none was dropped.</p> },
  play: async ({ canvas }) => {
    const band = canvas.getByRole('region', { name: 'Relations' });
    await expect(within(band).getByRole('heading', { level: 2 })).toHaveTextContent('0');
  },
};
