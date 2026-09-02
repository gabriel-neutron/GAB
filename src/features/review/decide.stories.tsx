import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { Decide } from './decide';

const onDecide = fn();

const onUndo = fn();

const meta = {
  component: Decide,
  args: { decision: null, busy: false, onDecide, onUndo },
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

/** The promotion is written the moment it is taken, so this screen asks once before it sends. */
export const APromotionIsAskedBeforeItIsWritten: Story = {
  // Its own mock: the one above is shared by every story of this file, and a call counted here
  // must be a call this story made.
  args: { onDecide: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Promote/ }));
    await expect(args.onDecide).not.toHaveBeenCalled();
    await expect(canvas.getByText(/no door takes it back/)).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Promote it' }));
    await expect(args.onDecide).toHaveBeenCalledWith('promoted', '');
  },
};

/** The press that opens the question must not answer it. The confirm control stands where
 * `Reject` stood, so a kept node would put `Reject it` under the hand of that same press. */
export const OnePressOnRejectAsksAndASecondSendsNothing: Story = {
  // Its own mock: the one above is shared by every story of this file, and a call counted here
  // must be a call this story made.
  args: { onDecide: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Reject/ }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(/never waits again/);
    await userEvent.keyboard('{Enter}');
    await expect(args.onDecide).not.toHaveBeenCalled();
    await expect(canvas.getByRole('alert')).toHaveTextContent(/never waits again/);
  },
};

/** The question stands where the control that opened it stood, so the second press of a double
 * press lands on it. That press belongs to the question and it must never answer it. */
export const ADoublePressOnRejectAsksAndSendsNothing: Story = {
  // Its own mock: the one above is shared by every story of this file, and a call counted here
  // must be a call this story made.
  args: { onDecide: fn() },
  play: async ({ args, canvas }) => {
    const reject = canvas.getByRole('button', { name: /Reject/ });
    const box = reject.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;

    await userEvent.click(reject);

    // The second press of the pair lands on whatever now stands under the hand, and the browser
    // counts it as the second of one sequence.
    const under = document.elementFromPoint(x, y);
    await expect(under?.closest('button')).toBeInstanceOf(HTMLButtonElement);
    under?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, detail: 2, clientX: x, clientY: y }),
    );

    await expect(args.onDecide).not.toHaveBeenCalled();
    await expect(canvas.getByRole('alert')).toHaveTextContent(/never waits again/);
  },
};

/** The way back from the question is kept whole. On the promotion path the hand lands on the
 * control that keeps the act waiting, so one press cancels and the next asks again. */
export const TheWayBackFromThePromotionQuestionIsWhole: Story = {
  // Its own mock: the one above is shared by every story of this file, and a call counted here
  // must be a call this story made.
  args: { onDecide: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Promote/ }));
    await expect(canvas.getByText(/no door takes it back/)).toBeInTheDocument();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.queryByText(/no door takes it back/)).toBeNull();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByText(/no door takes it back/)).toBeInTheDocument();
    await expect(args.onDecide).not.toHaveBeenCalled();
  },
};

/** The question interrupts. The hand that opened it may stand nowhere, so a reader must meet the
 * question and never look for it. */
export const TheQuestionInterruptsTheReader: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Promote/ }));
    await expect(canvas.getByRole('alert')).toHaveTextContent(
      'Promote this act? It writes the row, and no door takes it back.',
    );
  },
};

/** The rule the box waits for is the description of the box, and not a sentence beside it. */
export const TheBlankHoldNoteDescribesTheBox: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Not yet/ }));
    const box = canvas.getByLabelText('Why not yet');
    await expect(box).toHaveAccessibleDescription('A hold takes a written reason.');
    // The box is empty, and an empty box holds no value the vocabulary refused.
    await expect(box).not.toHaveAttribute('aria-invalid');
    await userEvent.type(box, 'The second reading is not in yet');
    await expect(box).toHaveAccessibleDescription('');
  },
};

/** A promotion stands in the record, and no door takes it back. The screen offers none. */
export const APromotionThatStandsOffersNoWayBack: Story = {
  args: { decision: { verdict: 'promoted', reason: '' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Promoted into the record')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /Undo/ })).toBeNull();
  },
};

/** One act reaches the record at a time. */
export const NoActIsTakenWhileOneIsGoing: Story = {
  args: { busy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Promote/ })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /Reject/ })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /Not yet/ })).toBeDisabled();
  },
};

/** A hold writes nothing, so it is the one verdict that is taken back while the pass lasts. The
 * reason is collected, so the same row draws it. */
export const AHoldDrawsItsReasonAndIsTakenBack: Story = {
  args: { decision: { verdict: 'deferred', reason: 'The second reading is not in yet' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Held on this pass')).toBeInTheDocument();
    await expect(canvas.getByText('The second reading is not in yet')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: /Undo/ })).toBeInTheDocument();
  },
};

/** A hold takes a written reason. Spaces state nothing, so the control waits, and the screen says
 * what it waits for. */
export const AHoldWithABlankReasonIsRefusedAndSaidWhy: Story = {
  // Its own mock: the one above is shared by every story of this file, and a call counted here
  // must be a call this story made.
  args: { onDecide: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Not yet/ }));
    await expect(canvas.getByRole('button', { name: 'Hold' })).toBeDisabled();
    await expect(canvas.getByText('A hold takes a written reason.')).toBeInTheDocument();
    await userEvent.type(canvas.getByLabelText('Why not yet'), '   ');
    await expect(canvas.getByRole('button', { name: 'Hold' })).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Why not yet'), 'The second reading is not in yet');
    await expect(canvas.getByRole('button', { name: 'Hold' })).toBeEnabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Hold' }));
    await expect(args.onDecide).toHaveBeenCalledWith(
      'deferred',
      '   The second reading is not in yet',
    );
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
