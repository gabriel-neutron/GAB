import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { ShownLine } from './shown-line';

const meta = {
  component: ShownLine,
  args: {
    entities: { shown: 770, total: 770 },
    relations: { shown: 1200, total: 1200 },
  },
} satisfies Meta<typeof ShownLine>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SaysShownOfTotalForEntitiesAndRelations: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/^Showing/u)).toHaveTextContent(
      'Showing 770 of 770 entities, 1200 of 1200 relations.',
    );
  },
};

/** A focus shows a part, and the line says the part and the whole. */
export const AFocusShowsAPart: Story = {
  args: { entities: { shown: 11, total: 770 }, relations: { shown: 10, total: 1200 } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/^Showing/u)).toHaveTextContent(
      'Showing 11 of 770 entities, 10 of 1200 relations.',
    );
  },
};

export const TheHintSaysWhatTheSwitchesAndTheFilterDo: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/^Showing/u)).toHaveTextContent('A type switch dims that type');
    await expect(canvas.getByText(/^Showing/u)).toHaveTextContent('narrows the lists only');
  },
};
