import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { expect, within } from 'storybook/test';

import { SiteHeader, type SiteHeaderProps } from './site-header';

// The links need a router, so the story gives the header a root route of its own.
const inRouterAt = (path: string) => (props: SiteHeaderProps) => (
  <RouterProvider
    router={createRouter({
      routeTree: createRootRoute({ component: () => <SiteHeader {...props} /> }),
      history: createMemoryHistory({ initialEntries: [path] }),
    })}
  />
);

const meta = {
  component: SiteHeader,
  args: { writerOnline: false, filter: null, actions: null },
  render: inRouterAt('/search'),
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SiteHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithNoWriterNoPageThatWritesIsListed: Story = {
  play: async ({ canvas }) => {
    const nav = await canvas.findByRole('navigation', { name: 'Pages of the site' });
    await expect(nav).toBeVisible();
    await expect(within(nav).getByRole('link', { name: /^Report$/ })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Data' })).toBeVisible();
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
    await expect(await canvas.findByRole('link', { name: 'Data' })).toHaveAttribute(
      'data-status',
      'active',
    );
  },
};

/** A route that no view owns marks no view, and a review marks only itself. */
export const ARouteNoViewOwnsMarksNone: Story = {
  render: inRouterAt('/vessel/9876543'),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'Report' })).not.toHaveAttribute(
      'data-section-active',
      'true',
    );
    await expect(canvas.getByRole('link', { name: 'Data' })).not.toHaveAttribute(
      'data-section-active',
      'true',
    );
  },
};

export const OnlyTheReportOwnsTheFirstPage: Story = {
  render: inRouterAt('/'),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'Report' })).toHaveAttribute(
      'data-section-active',
      'true',
    );
  },
};
