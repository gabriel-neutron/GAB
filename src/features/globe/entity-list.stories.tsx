import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { EntityList } from './entity-list';
import { FIXTURE_RELEASE } from './fixture-release';
import { globeData } from './globe-data';

const data = globeData(FIXTURE_RELEASE.chain);

const meta = {
  component: EntityList,
  args: { data, entityHref: (id: string) => `/entity/${id}` },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof EntityList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EachEntityWithAPositionLinksToItsPage: Story = {
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: 'Entities with a position' });
    await expect(table).toBeVisible();
    for (const row of data.rows)
      await expect(canvas.getByRole('link', { name: row.label })).toHaveAttribute(
        'href',
        `/entity/${row.id}`,
      );
    await expect(table).toHaveTextContent('Fields');
  },
};

export const SaysSoWhenNoEntityHasAPosition: Story = {
  args: { data: { ...data, rows: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No entity of this release has a position.')).toBeVisible();
  },
};
