import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { expect, fn, userEvent } from 'storybook/test';

import { FirstVisitCard, type FirstVisitCardProps } from './first-visit-card';

// The links need a router, so the story gives the card a root route of its own.
const inRouter = (props: FirstVisitCardProps) => (
  <RouterProvider
    router={createRouter({
      routeTree: createRootRoute({ component: () => <FirstVisitCard {...props} /> }),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })}
  />
);

const meta = {
  component: FirstVisitCard,
  args: { onClose: fn() },
  render: inRouter,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FirstVisitCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GivesTheScopeAndThreeWaysToStart: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByText(/sourced facts about the Russian/u)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Search' })).toHaveAttribute('href', '/search');
    await expect(canvas.getByText(/Use this map/u)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open the graph' })).toHaveAttribute(
      'href',
      expect.stringContaining('/graph'),
    );
  },
};

export const PointsToTheGlossaryAndTheHelpPage: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'glossary' })).toHaveAttribute(
      'href',
      '/glossary',
    );
    await expect(canvas.getByRole('link', { name: 'help page' })).toHaveAttribute('href', '/help');
  },
};

export const TheReaderCanCloseIt: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Close this card' }));
    await expect(args.onClose).toHaveBeenCalledOnce();
  },
};

export const ClosingKeepsTheFocusOnThePage: Story = {
  render: (props) => (
    <RouterProvider
      router={createRouter({
        routeTree: createRootRoute({
          component: () => (
            <div>
              <h1>Map</h1>
              <FirstVisitCard {...props} />
            </div>
          ),
        }),
        history: createMemoryHistory({ initialEntries: ['/'] }),
      })}
    />
  ),
  play: async ({ canvas }) => {
    await userEvent.click(await canvas.findByRole('button', { name: 'Close this card' }));
    await expect(canvas.getByRole('heading', { name: 'Map' })).toHaveFocus();
  },
};

export const InDarkTheCardKeepsItsBorder: Story = {
  decorators: [
    (Story) => (
      <div className="dark bg-background p-2 text-foreground">
        <Story />
      </div>
    ),
  ],
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('region', { name: 'Start here' })).toBeVisible();
  },
};
