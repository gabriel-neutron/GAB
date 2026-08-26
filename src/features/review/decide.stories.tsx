import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { Decide } from './decide';

const onDecide = fn();

const onUndo = fn();

const meta = {
  component: Decide,
  args: { decision: null, onDecide, onUndo },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="w-[560px] border-t border-border p-2">
      <Decide {...args} />
    </div>
  ),
} satisfies Meta<typeof Decide>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One act, one decision. No control on this surface accepts a group. */
export const TheThreeActsStandAndNoneTakesAGroup: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Promote/ })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Reject/ })).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Not yet/ })).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /all|every|selected/i })).toBeNull();
  },
};

/** The hold is read first and the promotion last, so the act of this pass and the act that cannot
 * be reversed stand at the two ends of the row. */
export const TheHoldIsReadFirstAndThePromotionLast: Story = {
  play: async ({ canvas }) => {
    const acts = canvas.getAllByRole('button').map((act) => act.textContent);
    await expect(acts).toEqual(['Not yet', 'Reject', 'Promote']);
  },
};

/** The real promotion cannot be reversed, so a verdict of the pass carries the way back. */
export const AVerdictOfThePassIsTakenBack: Story = {
  args: { decision: { verdict: 'promoted', reason: '' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Promoted on this pass')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Undo/ })).toBeInTheDocument();
  },
};

/** A reason that is collected is drawn. A field that is asked for and dropped is a lie. */
export const TheReasonOfAHoldIsDrawn: Story = {
  args: { decision: { verdict: 'deferred', reason: 'The second reading is not in yet' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Held on this pass')).toBeInTheDocument();
    await expect(canvas.getByText('The second reading is not in yet')).toBeInTheDocument();
  },
};

export const AHoldAsksWhyNotYet: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Not yet/ }));
    await expect(canvas.getByLabelText('Why not yet')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Hold' })).toBeInTheDocument();
  },
};

export const TheControlsHoldInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark w-[560px] border-t border-border bg-background p-2 text-foreground">
      <Decide {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Promote/ })).toBeInTheDocument();
  },
};
