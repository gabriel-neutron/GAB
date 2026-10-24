import type { Meta, StoryObj } from '@storybook/react-vite';
import { SEEDED_RELATION_TYPES } from '@gab/proposal/relation-types';
import { expect } from 'storybook/test';

import { GlossaryPage } from './glossary-page';

const meta = {
  component: GlossaryPage,
  parameters: { layout: 'fullscreen' },
  render: () => (
    <div className="h-svh">
      <GlossaryPage />
    </div>
  ),
} satisfies Meta<typeof GlossaryPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DefinesHostileClaimsAndPendingProposals: Story = {
  play: async ({ canvas }) => {
    for (const name of ['Hostile', 'Claims', 'Pending proposals'])
      await expect(canvas.getByText(name)).toBeVisible();
  },
};

export const DefinesEachRelationType: Story = {
  play: async ({ canvasElement }) => {
    for (const type of SEEDED_RELATION_TYPES) {
      const entry = canvasElement.querySelector(`[data-relation-type="${type.key}"]`);
      await expect(entry).toHaveTextContent(type.definition);
    }
  },
};

export const SaysHowAFarEndReadsATypeThatReadsDifferently: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/from the other end: is owned by/u)).toBeVisible();
  },
};
