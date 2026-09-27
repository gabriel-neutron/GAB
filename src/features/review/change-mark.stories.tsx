import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { ChangeMark } from './change-mark';

const meta = {
  component: ChangeMark,
  args: { kind: 'edit', kindWords: 'Modification' },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="w-[420px] p-2">
      <ChangeMark {...args} />
    </div>
  ),
} satisfies Meta<typeof ChangeMark>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheKindIsWrittenAndNotOnlyPainted: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Modification')).toBeInTheDocument();
  },
};

/** A deletion is a rarer and a costlier act, so it never carries the weight of a modification. */
export const ADeletionDoesNotCarryTheWeightOfAModification: Story = {
  args: { kind: 'delete', kindWords: 'Deletion' },
  render: (args) => (
    <div className="w-[420px] space-y-1 p-2">
      <ChangeMark kind="edit" kindWords="Modification" />
      <ChangeMark {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const edit = canvas.getByText('Modification');
    const removed = canvas.getByText('Deletion');
    await expect(getComputedStyle(removed).color).not.toEqual(getComputedStyle(edit).color);
    const glyphOf = (mark: HTMLElement) => mark.querySelector('svg')?.getAttribute('class');
    await expect(glyphOf(removed)).toBeTruthy();
    await expect(glyphOf(removed)).not.toEqual(glyphOf(edit));
  },
};

// Origin of a number: the `--added` token of the dark theme.
const DARK_ADDED = 'oklch(0.74 0.13 155)';

export const AnAdditionIsMarkedInTheDarkTheme: Story = {
  args: { kind: 'add', kindWords: 'Addition' },
  render: (args) => (
    <div className="dark w-[420px] bg-background p-2 text-foreground">
      <ChangeMark {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Addition')).toBeInTheDocument();
    const mark = canvasElement.querySelector<HTMLElement>('[data-kind="add"]');
    if (mark === null) throw new Error('the addition draws no mark');
    await expect(getComputedStyle(mark).color).toBe(DARK_ADDED);
  },
};
