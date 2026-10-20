import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { TextViewList } from './text-list';
import type { TextView } from './text-view';

const view: TextView = {
  kind: 'entity',
  name: 'Alpha',
  rows: [
    { entityId: 'b', label: 'Bravo', relationId: 'e1', relation: 'owns', direction: 'out' },
    {
      entityId: 'c',
      label: 'Charlie',
      relationId: 'e2',
      relation: 'managed by',
      direction: 'in',
    },
  ],
};

const meta = {
  component: TextViewList,
  args: { view, onOpenEntity: fn(), onOpenRelation: fn() },
} satisfies Meta<typeof TextViewList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SaysTheSelectedNameAndTheNeighbourCount: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Alpha: 2 neighbours.');
  },
};

export const ListsEachNeighbourWithTheTypeAndTheDirection: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Bravo' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'owns (outgoing)' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'managed by (incoming)' })).toBeVisible();
  },
};

export const ArrowsWalkTheNeighboursAndEnterOpensOne: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.tab();
    await expect(canvas.getByRole('button', { name: 'Bravo' })).toHaveFocus();
    await userEvent.keyboard('{ArrowDown}');
    await expect(canvas.getByRole('button', { name: 'Charlie' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenEntity).toHaveBeenCalledWith('c');
  },
};

export const ArrowRightReachesTheRelationAndEnterOpensIt: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.tab();
    await userEvent.keyboard('{ArrowRight}');
    await expect(canvas.getByRole('button', { name: 'owns (outgoing)' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await expect(args.onOpenRelation).toHaveBeenCalledWith('e1');
  },
};

export const EscapeLeavesTheList: Story = {
  play: async ({ canvas }) => {
    await userEvent.tab();
    await userEvent.keyboard('{Escape}');
    await expect(canvas.getByRole('region', { name: 'Text view of the selection' })).toHaveFocus();
  },
};

export const NothingSelectedSaysSo: Story = {
  args: { view: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Nothing is selected');
    await expect(canvas.queryByRole('button')).toBeNull();
  },
};
