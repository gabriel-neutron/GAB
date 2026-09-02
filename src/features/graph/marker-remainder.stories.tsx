import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { MarkerRemainder } from './marker-remainder';

const meta = {
  component: MarkerRemainder,
  args: { drawn: 1000, remainder: 400 },
} satisfies Meta<typeof MarkerRemainder>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An element past the cut carries no marker, so no marker cannot be read as no evidence. */
export const TheCutIsStatedWhereItBites: Story = {
  play: async ({ canvas, canvasElement }) => {
    const line = canvasElement.querySelector('[data-marker-remainder]');
    if (line === null) throw new Error('The surface states no remainder');
    await expect(line).toHaveAttribute('data-marker-remainder', '400');
    await expect(canvas.getByRole('status')).toBeVisible();
  },
};

/** A bare count does not say which elements took the markers. The line says the rule. */
export const TheLineNamesTheRank: Story = {
  play: async ({ canvas }) => {
    const line = canvas.getByRole('status');
    await expect(line).toHaveTextContent('most pending evidence first');
    await expect(line).toHaveTextContent('1000 of 1400');
    await expect(line).toHaveTextContent('400 elements carry pending evidence and no marker');
  },
};

/** A remainder of one is a real case, and "1 elements carry" is not a sentence. */
export const OneElementReadsAsOne: Story = {
  args: { drawn: 3, remainder: 1 },
  play: async ({ canvas }) => {
    const line = canvas.getByRole('status');
    await expect(line).toHaveTextContent('1 element carries pending evidence and no marker');
    await expect(line).not.toHaveTextContent('1 elements');
  },
};

/** The cut bites on almost no corpus, and a line that always shows is noise on every open. */
export const NoRemainderDrawsNoLine: Story = {
  args: { drawn: 12, remainder: 0 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-marker-remainder]')).toBeNull();
    await expect(canvasElement.querySelector('[role="status"]')).toBeNull();
  },
};
