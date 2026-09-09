import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { UnplacedCount } from './unplaced-count';

const meta = {
  component: UnplacedCount,
  args: { unplaced: 42 },
} satisfies Meta<typeof UnplacedCount>;

export default meta;

type Story = StoryObj<typeof meta>;

/** An entity on the band stands where its identifier puts it, so the picture around it is false. */
export const TheBandIsStatedWhereItHolds: Story = {
  play: async ({ canvas, canvasElement }) => {
    const line = canvasElement.querySelector('[data-unplaced-count]');
    if (line === null) throw new Error('The surface states no unplaced count');
    await expect(line).toHaveAttribute('data-unplaced-count', '42');
    await expect(canvas.getByRole('status')).toBeVisible();
  },
};

/** A bare count does not say why the place is false. The line says where they stand, and why. */
export const TheLineNamesTheBand: Story = {
  play: async ({ canvas }) => {
    const line = canvas.getByRole('status');
    await expect(line).toHaveTextContent('The layout run placed no position for 42 entities');
    await expect(line).toHaveTextContent('on the outer band, at a place read from the identifier');
  },
};

/** A count of one is a real case, and "1 entities stand" is not a sentence. */
export const OneEntityReadsAsOne: Story = {
  args: { unplaced: 1 },
  play: async ({ canvas }) => {
    const line = canvas.getByRole('status');
    await expect(line).toHaveTextContent('for 1 entity. It stands');
    await expect(line).not.toHaveTextContent('1 entities');
  },
};

/** A whole corpus is placed after a layout run, and a line that always shows is noise on it. */
export const NoUnplacedDrawsNoLine: Story = {
  args: { unplaced: 0 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-unplaced-count]')).toBeNull();
    await expect(canvasElement.querySelector('[role="status"]')).toBeNull();
  },
};
