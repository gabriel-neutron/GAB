import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { expect } from 'storybook/test';

import { SiteHeader, type SiteHeaderProps } from './site-header';

// The links need a router, so the story gives the header a root route of its own.
const inRouter = (props: SiteHeaderProps) => (
  <RouterProvider
    router={createRouter({
      routeTree: createRootRoute({ component: () => <SiteHeader {...props} /> }),
      history: createMemoryHistory({ initialEntries: ['/search'] }),
    })}
  />
);

const meta = {
  component: SiteHeader,
  args: { writerOnline: false, filter: null, actions: null },
  render: inRouter,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithNoWriterNoPageThatWritesIsListed: Story = {
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Pages of the site' });
    await expect(nav).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Search' })).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Review' })).toBeNull();
  },
};

export const WithTheWriterTheReviewIsListed: Story = {
  args: { writerOnline: true },
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'Review' })).toBeVisible();
  },
};

export const TheNameOfTheDatasetOpensTheFirstPage: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'GAB dataset' })).toHaveAttribute(
      'href',
      '/',
    );
  },
};

export const TheOpenPageIsMarked: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'Search' })).toHaveAttribute(
      'data-status',
      'active',
    );
  },
};
