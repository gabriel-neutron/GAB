import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { createGlobeStore } from './globe-store';
import { ProductFilter } from './product-filter';

const fresh = () => createGlobeStore({ steps: ['extraction'], still: false, entity: null });

const meta = {
  component: ProductFilter,
  args: { store: fresh() },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="dark relative h-24 w-96 bg-background text-foreground">
      <ProductFilter {...args} />
    </div>
  ),
} satisfies Meta<typeof ProductFilter>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AllChainsAreOnAndAPressKeepsOneProductChain: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Gas and LNG' }));
    await expect(args.store.get().product).toBe('gas');
    await expect(canvas.getByRole('button', { name: 'Gas and LNG' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(canvas.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await userEvent.click(canvas.getByRole('button', { name: 'All' }));
    await expect(args.store.get().product).toBe('all');
  },
};
