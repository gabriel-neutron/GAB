import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import type { CriticalNode } from '@gab/release/site-release';

import { NodesPage } from './nodes-page';

const node = (over: Partial<CriticalNode> & Pick<CriticalNode, 'id' | 'label'>): CriticalNode => ({
  type: 'facility',
  controller: 'Operator A',
  bypassPattern: 'Transshipment by tanker',
  conditions: [
    { key: 'a', state: 'sourced', claimIds: ['claim-1'] },
    { key: 'b', state: 'sourced', claimIds: ['claim-2'] },
    { key: 'c', state: 'not sourced', claimIds: [] },
  ],
  ticks: 3,
  sourcedTicks: 2,
  retained: true,
  ...over,
});

const NODES = [
  node({ id: 'n1', label: 'Primorsk oil terminal' }),
  node({ id: 'n2', label: 'Novorossiysk jetty', retained: false, sourcedTicks: 1 }),
];

const meta = {
  component: NodesPage,
  args: {
    release: { date: '2026-11-08', nodes: NODES },
    entityHref: (id: string) => `/entity/${id}`,
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-svh">
      <NodesPage {...args} />
    </div>
  ),
} satisfies Meta<typeof NodesPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GroupsTheRetainedNodesFirstAndNamesTheRelease: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('From the release of 08/11/2026')).toBeVisible();
    await expect(canvas.getByText('2 candidate nodes, 1 retained.')).toBeVisible();
    await expect(canvas.getByRole('table', { name: 'Retained nodes' })).toBeVisible();
    await expect(canvas.getByRole('table', { name: 'Other candidate nodes' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Primorsk oil terminal' })).toHaveAttribute(
      'href',
      '/entity/n1',
    );
  },
};

export const SaysNotSourcedInWords: Story = {
  play: async ({ canvas }) => {
    await expect((await canvas.findAllByText('not sourced')).length).toBeGreaterThan(0);
  },
};

export const SaysSoWhenTheSiteHoldsNoRelease: Story = {
  args: { release: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/holds no release/u)).toBeVisible();
  },
};
