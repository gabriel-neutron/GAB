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
  play: async ({ canvas, canvasElement }) => {
    const edit = canvasElement.querySelector('[data-kind="edit"]');
    const removed = canvasElement.querySelector('[data-kind="delete"]');
    await expect(edit).toHaveTextContent('Modification');
    await expect(removed).toHaveTextContent('Deletion');
    await expect(edit?.getAttribute('data-kind')).not.toEqual(removed?.getAttribute('data-kind'));
    await expect(canvas.getByText('Deletion')).toBeInTheDocument();
  },
};

export const AnAdditionIsMarkedInTheDarkTheme: Story = {
  args: { kind: 'add', kindWords: 'Addition' },
  render: (args) => (
    <div className="dark w-[420px] bg-background p-2 text-foreground">
      <ChangeMark {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Addition')).toBeInTheDocument();
  },
};
