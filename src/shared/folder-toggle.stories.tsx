import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { FolderToggle } from '@/shared/folder-toggle';

const onOpen = fn();

const meta = {
  component: FolderToggle,
  args: {
    unit: { id: 'u1', depth: 0, subordinates: 3, open: false },
    name: '92nd Coastal Battery',
    onOpen,
  },
  render: (args) => (
    <div className="flex h-6 w-60 items-center text-xs">
      <FolderToggle {...args} />
      <span>{args.name}</span>
    </div>
  ),
} satisfies Meta<typeof FolderToggle>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The control names the act, the count and the unit, because a chevron alone says none of it. */
export const AClosedFolderOpensItsSubordinates: Story = {
  play: async ({ canvas, args }) => {
    const toggle = canvas.getByRole('button', {
      name: 'Open the 3 subordinates of 92nd Coastal Battery',
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    await expect(args.onOpen).toHaveBeenCalledWith('u1', true);
  },
};

export const AnOpenFolderClosesAgain: Story = {
  args: { unit: { id: 'u1', depth: 0, subordinates: 1, open: true } },
  play: async ({ canvas, args }) => {
    const toggle = canvas.getByRole('button', {
      name: 'Close the 1 subordinate of 92nd Coastal Battery',
    });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(toggle);
    await expect(args.onOpen).toHaveBeenCalledWith('u1', false);
  },
};

/** A unit with no subordinate has nothing to open, so it gets no control. */
export const AUnitWithNoSubordinateHasNoControl: Story = {
  args: { unit: { id: 'u2', depth: 2, subordinates: 0, open: false } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByRole('button')).toBeNull();
    await expect(canvasElement.querySelector('[data-depth="2"]')).not.toBeNull();
  },
};
