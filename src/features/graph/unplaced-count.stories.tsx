import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { UnplacedCount } from './unplaced-count';

const meta = {
  component: UnplacedCount,
  args: { unplaced: 42, shown: true, onSwitch: fn() },
} satisfies Meta<typeof UnplacedCount>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The count is on the element, so a check reads it without a parse of the sentence. */
export const TheCountIsStated: Story = {
  play: async ({ canvas, canvasElement }) => {
    const line = canvasElement.querySelector('[data-unplaced-count]');
    if (line === null) throw new Error('The surface states no unplaced count');
    await expect(line).toHaveAttribute('data-unplaced-count', '42');
    await expect(canvas.getByRole('status')).toBeVisible();
  },
};

/** A bare count does not say why the place is false. The line says it, and names the style. */
export const TheLineSaysWhyAndNamesTheStyle: Story = {
  play: async ({ canvas }) => {
    const line = canvas.getByRole('status');
    await expect(line).toHaveTextContent('42 new entities have no place yet.');
    await expect(line).toHaveTextContent('Their place on the ring means nothing.');
    await expect(line).toHaveTextContent('Grey dots on the outer ring');
  },
};

/** A count of one is a real case, and "1 new entities" is not a sentence. */
export const OneEntityReadsAsOne: Story = {
  args: { unplaced: 1 },
  play: async ({ canvas }) => {
    const line = canvas.getByRole('status');
    await expect(line).toHaveTextContent('1 new entity has no place yet. Its place on the ring');
    await expect(line).not.toHaveTextContent('1 new entities');
  },
};

/** The switch hides the entities with no place. */
export const TheSwitchAsksToHide: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Hide them' }));
    await expect(args.onSwitch).toHaveBeenCalledWith(false);
  },
};

/** While they are hidden, the same switch brings them back. */
export const TheSwitchAsksToShow: Story = {
  args: { shown: false },
  play: async ({ canvas, args }) => {
    const button = canvas.getByRole('button', { name: 'Show them' });
    await expect(canvas.getByRole('status')).not.toHaveTextContent('Grey dots');
    await userEvent.click(button);
    await expect(args.onSwitch).toHaveBeenCalledWith(true);
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
