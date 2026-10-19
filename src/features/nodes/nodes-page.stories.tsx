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
    release: {
      date: '2026-11-08',
      nodes: NODES,
      claims: {
        'claim-1': { text: 'Primorsk oil terminal: Designated by Council', pair: null },
        'claim-2': {
          text: 'Primorsk oil terminal: Loads at Primorsk',
          pair: { letter: 'B', digit: '2' },
        },
      },
      imoOf: { n1: '9000001' },
    },
    entityHref: (id: string) => `/entity/${id}`,
    vesselHref: (imo: string) => `/vessel/${imo}`,
    claimHref: (id: string) => `/claim/${id}`,
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

export const LinksTheTimelineOfAVesselNodeByItsIMONumber: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Timeline of IMO 9000001' })).toHaveAttribute(
      'href',
      '/vessel/9000001',
    );
    await expect(canvas.getAllByRole('link', { name: /^Timeline of IMO/u })).toHaveLength(1);
  },
};

export const LinksTheClaimOfATickWithItsNATOPair: Story = {
  play: async ({ canvas }) => {
    const links = await canvas.findAllByRole('link', {
      name: 'Primorsk oil terminal: Designated by Council',
    });
    await expect(links[0]).toHaveAttribute('href', '/claim/claim-1');
    await expect((await canvas.findAllByText('NATO B2')).length).toBeGreaterThan(0);
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
