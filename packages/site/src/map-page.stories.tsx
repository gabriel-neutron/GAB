import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { FIXTURE_RELEASE } from './fixture-release.ts';
import { MapPage } from './map-page.tsx';

// The story renders the page without the map script, so no live canvas starts. The built site
// runs the script.
const meta = {
  component: MapPage,
  args: { release: FIXTURE_RELEASE.off },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MapPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EachEntityWithAPositionIsListed: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('region', { name: 'Map of the entities with a position' }),
    ).toBeVisible();
    await expect(
      canvas.getByText(/2 entities of this release have their own position/u),
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Primorsk' })).toHaveAttribute(
      'href',
      '../entity/0a1f0000-0000-4000-8000-000000000004/index.html',
    );
  },
};
