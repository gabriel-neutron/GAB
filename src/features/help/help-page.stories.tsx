import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { expect } from 'storybook/test';

import { HelpPage } from './help-page';

// The links need a router, so the story gives the page a root route of its own.
const meta = {
  component: HelpPage,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="h-svh">
      <RouterProvider
        router={createRouter({
          routeTree: createRootRoute({ component: HelpPage }),
          history: createMemoryHistory({ initialEntries: ['/'] }),
        })}
      />
    </div>
  ),
} satisfies Meta<typeof HelpPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const LinksToTheGlossary: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('link', { name: 'glossary' })).toHaveAttribute(
      'href',
      '/glossary',
    );
  },
};

export const ExplainsHowTheFactsAreChecked: Story = {
  play: async ({ canvas }) => {
    await expect(
      await canvas.findByRole('heading', { name: 'How the facts are checked' }),
    ).toBeVisible();
    await expect(canvas.getByText(/cites at least one stored document/u)).toBeVisible();
  },
};
