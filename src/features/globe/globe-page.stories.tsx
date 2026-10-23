import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';

import { GlobePage } from './globe-page';

// Only the page with no release is storied here: with a release the page mounts the live canvas,
// and no story mounts one. Each panel of the page has its own story.
const meta = {
  component: GlobePage,
  args: {
    data: null,
    entity: '',
    entityHref: (id: string) => `/entity/${id}`,
    onSelect: fn(),
    onCloseFirstVisit: null,
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-svh">
      <GlobePage {...args} />
    </div>
  ),
} satisfies Meta<typeof GlobePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SaysSoWhenTheSiteHoldsNoRelease: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Carte' })).toBeVisible();
    await expect(canvas.getByText(/holds no release/u)).toBeVisible();
  },
};
