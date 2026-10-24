import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { coverageOf } from '@gab/release/coverage';
import { withReferenceLabel } from '@gab/release/reference-label';
import type { SiteManifest } from '@gab/release/site-manifest';
import type { CriticalNode } from '@gab/release/site-release';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';

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

const COUNTS = { added: 0, changed: 0, removed: 0, merged: 0, unmerged: 0 };

const MANIFEST: SiteManifest = {
  version: '1.0',
  date: '2026-11-08',
  showNatoPair: true,
  dateRules: { eu: 'entry_into_force', ofac: 'recent_actions_notice', uk: 'date_designated' },
  disclaimer: withReferenceLabel(
    '**About this data.** A machine reads public documents and proposes each claim.\n\n- **Proposed — not checked:** a candidate.\n\nReport an error: https://example.org/report-an-error.',
  ),
  contacts: {
    reportError: 'https://example.org/report-an-error',
    rightOfReply: 'mailto:reply@example.org',
  },
  iriBase: 'https://gab.example.org/',
  changelog: {
    path: 'changelog.csv',
    previous: null,
    entities: COUNTS,
    relations: COUNTS,
    claims: COUNTS,
  },
  nameCandidates: { proposed: 0, confirmed: 0, refused: 0 },
  coverage: coverageOf(['facility', 'facility', 'company'], 2),
  files: [],
};

const meta = {
  component: NodesPage,
  args: {
    release: {
      manifest: MANIFEST,
      nodes: NODES,
      claims: {
        'claim-1': {
          text: 'Primorsk oil terminal: Designated by Council',
          rating: { shown: true, pair: null },
        },
        'claim-2': {
          text: 'Primorsk oil terminal: Loads at Primorsk',
          rating: { shown: true, pair: { letter: 'B', digit: '2' } },
        },
      },
      imoOf: { n1: '9000001' },
    },
    entityHref: (id: string) => `/entity/${id}`,
    vesselHref: (imo: string) => `/vessel/${imo}`,
    claimHref: (id: string) => `/claim/${id}`,
  },
  parameters: { layout: 'fullscreen' },
  // The links to the graph and the map need a router, so the story gives the page a root route.
  render: (args) => (
    <div className="h-svh">
      <RouterProvider
        router={createRouter({
          routeTree: createRootRoute({ component: () => <NodesPage {...args} /> }),
          history: createMemoryHistory({ initialEntries: ['/'] }),
        })}
      />
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

export const LinksTheClaimOfATickWithItsAdmiraltyPair: Story = {
  play: async ({ canvas }) => {
    const links = await canvas.findAllByRole('link', {
      name: 'Primorsk oil terminal: Designated by Council',
    });
    await expect(links[0]).toHaveAttribute('href', '/claim/claim-1');
    await expect((await canvas.findAllByText('B2')).length).toBeGreaterThan(0);
    await expect((await canvas.findAllByText('Not rated')).length).toBeGreaterThan(0);
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

export const GivesTheCountsAndEveryLabelEvenWithNoNode: Story = {
  args: {
    release: {
      manifest: MANIFEST,
      nodes: [],
      claims: {},
      imoOf: {},
    },
  },
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/holds 3 entities and cites 2 sources/u)).toBeVisible();
    await expect(canvas.getByText(/This release has no candidate node/u)).toBeVisible();
    await expect(canvas.getByText(/Reference dataset …/u)).toBeVisible();
  },
};
