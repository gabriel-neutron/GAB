import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { StartPanel } from './start-panel';

const NAMED = Array.from({ length: 12 }, (_, index) => ({
  id: `entity-${String(index)}`,
  label: index === 3 ? 'Aurora Shipping' : `Entity ${String(index)}`,
  degree: 20 - index,
}));

const meta = {
  component: StartPanel,
  args: { named: NAMED, onChoose: fn(), onShowWholeGraph: fn() },
  decorators: [
    (Story) => (
      <div className="dark relative h-96 w-[40rem] bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof StartPanel>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The graph opens on the most connected entities, and not on the whole picture. */
export const TheGraphOpensOnTheMostConnectedEntities: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The most connected entities:')).toBeVisible();
    await expect(canvas.getAllByRole('button', { name: /^Entity/ })).toHaveLength(7);
    await expect(canvas.getByRole('button', { name: /Entity 0/ })).toBeVisible();
  },
};

/** A choice names the entity, and the graph draws it with its neighbours. */
export const AChoiceNamesTheEntity: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Entity 1/ }));
    await expect(args.onChoose).toHaveBeenCalledWith('entity-1');
  },
};

/** The box finds an entity that is not among the most connected. */
export const TheSearchBoxFindsAnEntityByName: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.type(
      canvas.getByRole('searchbox', { name: 'Search an entity by name' }),
      'aurora',
    );
    await expect(canvas.getByText('1 of 1 entities match.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: /Aurora Shipping/ }));
    await expect(args.onChoose).toHaveBeenCalledWith('entity-3');
  },
};

/** The whole picture stays one click away, for the reader who wants it. */
export const TheWholeGraphStaysOneClickAway: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Show the whole graph' }));
    await expect(args.onShowWholeGraph).toHaveBeenCalled();
  },
};
