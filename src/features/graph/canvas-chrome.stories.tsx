import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { Legend, StatusBar, ZoomButtons } from './canvas-chrome';
import { buildGraphModel } from './model';
import { countShown } from './shown-counts';

const positions = new Map(
  corpus.entities.map((entity, index) => [entity.id, { x: index, y: index }]),
);
const model = buildGraphModel(corpus, positions, entityTypes, 'dark', new Set());
const counts = countShown(model.graph, new Set(model.graph.nodes()), new Set());

const meta = {
  component: Legend,
  args: { counts, hueOfType: model.hueOfType, labelOfType: model.labelOfType },
  decorators: [
    (Story) => (
      <div className="relative h-[28rem] w-[40rem] bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Legend>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The legend lists the types and the families in view, with their counts. */
export const ListsTheTypesAndFamiliesInView: Story = {
  render: (args) => (
    <>
      <StatusBar counts={args.counts} />
      <Legend {...args} />
    </>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('entities');
    await expect(canvas.getByRole('list', { name: 'Entity types' })).toBeVisible();
    await expect(canvas.getByRole('list', { name: 'Relation families' })).toBeVisible();
  },
};

/** A button zooms one step, in or out. */
export const ZoomsInAndOut: Story = {
  render: () => <ZoomButtons onZoom={zoom} />,
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Zoom in' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Zoom out' }));
    await expect(zoom).toHaveBeenNthCalledWith(1, 'in');
    await expect(zoom).toHaveBeenNthCalledWith(2, 'out');
  },
};

const zoom = fn();
