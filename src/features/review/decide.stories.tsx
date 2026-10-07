import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { Decide } from './decide';

const onDecide = fn();

const meta = {
  component: Decide,
  args: { kind: 'edit', decision: null, busy: false, onDecide },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="w-[560px] border-t border-border p-2">
      <Decide {...args} />
    </div>
  ),
} satisfies Meta<typeof Decide>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One act, one decision, and two verdicts. No control on this surface accepts a group, and no
 * control holds an act on this pass. */
export const TheTwoActsStandAndNoneTakesAGroup: Story = {
  play: async ({ canvas }) => {
    const acts = canvas.getAllByRole('button').map((act) => act.textContent);
    await expect(acts).toEqual(['Reject', 'Promote']);
    await expect(canvas.queryByRole('button', { name: /all|every|selected/i })).toBeNull();
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
    await expect(args.onDecide).toHaveBeenCalledWith('promoted');
  },
};

export const ARejectionIsAskedAndThenSent: Story = {
  args: { onDecide: fn() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Reject/ }));
    await expect(args.onDecide).not.toHaveBeenCalled();
    await userEvent.click(canvas.getByRole('button', { name: 'Reject it' }));
    await expect(args.onDecide).toHaveBeenCalledOnce();
    await expect(args.onDecide).toHaveBeenCalledWith('rejected');
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

/** A promotion stands in the record, and no door takes it back. The screen offers none. */
export const APromotionThatStandsOffersNoWayBack: Story = {
  args: { decision: { verdict: 'promoted' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Promoted into the record')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: /Undo/ })).toBeNull();
  },
};

/** The record refuses every merge at promotion, so the screen offers none, and it says why. A
 * merge is not final, so the screen says nothing about a door back. */
export const AMergeCannotBePromotedAndTheScreenSaysWhy: Story = {
  args: { kind: 'merge', onDecide: fn() },
  play: async ({ args, canvas }) => {
    const promote = canvas.getByRole('button', { name: /Promote/ });
    await expect(promote).toBeDisabled();
    await expect(promote).toHaveAccessibleDescription('A merge has no write path yet.');
    await expect(canvas.getByText('A merge has no write path yet.')).toBeVisible();
    await expect(canvas.queryByText(/no door takes it back/)).toBeNull();
    await expect(canvas.getByRole('button', { name: /Reject/ })).toBeEnabled();
    await expect(args.onDecide).not.toHaveBeenCalled();
  },
};

/** Only a merge is refused. Every other kind of act keeps its promotion. */
export const EveryKindButAMergeKeepsItsPromotion: Story = {
  render: (args) => (
    <div className="w-[560px] space-y-2 border-t border-border p-2">
      <Decide {...args} kind="add" />
      <Decide {...args} kind="edit" />
      <Decide {...args} kind="delete" />
    </div>
  ),
  play: async ({ canvas }) => {
    const promotions = canvas.getAllByRole('button', { name: /Promote/ });
    await expect(promotions).toHaveLength(3);
    for (const promote of promotions) await expect(promote).toBeEnabled();
    await expect(canvas.queryByText('A merge has no write path yet.')).toBeNull();
  },
};

/** One act reaches the record at a time. */
export const NoActIsTakenWhileOneIsGoing: Story = {
  args: { busy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /Promote/ })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /Reject/ })).toBeDisabled();
  },
};

// Origin of a number: the `--primary` token of the dark theme.
const DARK_PRIMARY = 'oklch(0.76 0.14 235)';

export const TheControlsHoldInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark w-[560px] border-t border-border bg-background p-2 text-foreground">
      <Decide {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const promote = canvas.getByRole('button', { name: /Promote/ });
    await expect(getComputedStyle(promote).backgroundColor).toBe(DARK_PRIMARY);
  },
};
