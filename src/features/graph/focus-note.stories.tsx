import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { FocusNote } from './focus-note';

const meta = {
  component: FocusNote,
  args: { drawn: 161, unnamed: 121, unnamedRelations: 120 },
} satisfies Meta<typeof FocusNote>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A node without a name must not read as a node the record does not name. */
export const TheNoteSaysHowManyStandWithoutAName: Story = {
  play: async ({ canvas }) => {
    const line = canvas.getByRole('status');
    await expect(line).toHaveTextContent('The focus draws 161 nodes');
    await expect(line).toHaveTextContent('121 nodes and 120 relations stand without a name');
  },
};

/** A focus where every element has a name needs no note. */
export const NoCutDrawsNoNote: Story = {
  args: { drawn: 12, unnamed: 0, unnamedRelations: 0 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[role="status"]')).toBeNull();
  },
};
