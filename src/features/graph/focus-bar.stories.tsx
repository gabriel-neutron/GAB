import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { FocusBar } from './focus-bar';

const meta = {
  component: FocusBar,
  args: { hops: 1, expandable: 4, onHops: fn(), onExpand: fn(), onBack: fn() },
  decorators: [
    (Story) => (
      <div className="dark relative h-24 w-[40rem] bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof FocusBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The reader chooses one hop or two, and the choice in force is pressed. */
export const TheReaderChoosesOneHopOrTwo: Story = {
  play: async ({ canvas, args }) => {
    await expect(canvas.getByRole('button', { name: '1 hop' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(canvas.getByRole('button', { name: '2 hops' }));
    await expect(args.onHops).toHaveBeenCalledWith(2);
  },
};

/** The button says how many neighbours it adds. */
export const ExpandSaysHowManyNeighboursItAdds: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Expand this node (4 more)' }));
    await expect(args.onExpand).toHaveBeenCalled();
  },
};

/** A node with no neighbour left to draw cannot be expanded, and the button is off. */
export const ExpandIsOffWhenNothingIsLeftToAdd: Story = {
  args: { expandable: 0 },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Expand this node' })).toBeDisabled();
  },
};

/** The way back to every entity is always on the bar. */
export const BackReturnsToTheWholeGraph: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Back to the whole graph' }));
    await expect(args.onBack).toHaveBeenCalled();
  },
};
