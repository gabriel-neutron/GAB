import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { expect } from 'storybook/test';

import { NotAvailable } from './not-available';

// The link needs a router, so the story gives the component a root route of its own.
const router = createRouter({
  routeTree: createRootRoute({ component: NotAvailable }),
  history: createMemoryHistory({ initialEntries: ['/'] }),
});

const meta = {
  component: NotAvailable,
  render: () => <RouterProvider router={router} />,
} satisfies Meta<typeof NotAvailable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheReviewPageOfflineStatesItAndOffersTheMap: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('This part is not available here.')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Go to the map' }).getAttribute('href')).toMatch(
      /^\/map/,
    );
  },
};
