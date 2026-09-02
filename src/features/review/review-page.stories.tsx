import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { readQueue } from './queue';
import { ReviewPage } from './review-page';
import { SAMPLE, reviewSample, sampleChange } from './sample';

const SUBJECTS = readQueue(reviewSample, null);

const CONTESTED = SAMPLE.contestedRow;

const FIRST_ACT = sampleChange(CONTESTED).id;

const onAct = fn();

const meta = {
  component: ReviewPage,
  args: {
    queue: { subjects: SUBJECTS, verdicts: {} },
    examination: { subjectId: CONTESTED, sort: 'confidence' },
    decision: { step: 'idle' },
    onAct,
  },
  parameters: { layout: 'fullscreen' },
  // The shell gives this row the rest of the height, so a story states one of its own.
  render: (args) => (
    <div className="h-[720px] w-[1280px]">
      <ReviewPage {...args} />
    </div>
  ),
} satisfies Meta<typeof ReviewPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The queue, the subject and the evidence stand at once, and no act is opened to read them. */
export const TheThreePanesStandTogether: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole('navigation', { name: 'What waits for a decision' }),
    ).toBeInTheDocument();
    await expect(
      canvas.getByRole('button', { name: /The record as it stands/ }),
    ).toBeInTheDocument();
    await expect(canvasElement.querySelectorAll('[data-change]')).toHaveLength(1);
  },
};

/** Two acts that read one key are the reason the row is the unit, so they are read beside each
 * other and never one after the other. */
export const TwoActsThatContestOneKeyAreReadTogether: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Read them together/ }));
    await expect(canvasElement.querySelectorAll('[data-change]').length).toBeGreaterThan(1);
  },
};

/** The controls stay at one place, whatever stands above them. */
export const TheControlsDoNotMoveWhenTwoActsStandOpen: Story = {
  play: async ({ canvas, canvasElement }) => {
    const foot = canvasElement.querySelector('footer');
    await expect(foot).not.toBeNull();
    const before = foot?.getBoundingClientRect().top;
    await userEvent.click(canvas.getByRole('button', { name: /Read them together/ }));
    await expect(canvasElement.querySelectorAll('footer')).toHaveLength(1);
    await expect(canvasElement.querySelector('footer')?.getBoundingClientRect().top).toEqual(
      before,
    );
  },
};

/** No card is cut. A card that hides evidence in silence is worse than one that scrolls. */
export const NoCardHidesEvidenceWhenTwoStandOpen: Story = {
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Read them together/ }));
    for (const card of canvasElement.querySelectorAll('[data-change]')) {
      await expect(card.scrollWidth).toEqual(card.clientWidth);
    }
  },
};

/** A verdict reaches the line of the act, and the line says where the verdict stands. */
export const AVerdictReachesTheLineOfTheAct: Story = {
  args: {
    queue: { subjects: SUBJECTS, verdicts: { [FIRST_ACT]: { verdict: 'promoted', reason: '' } } },
  },
  play: async ({ canvas, canvasElement }) => {
    const line = canvasElement.querySelector(`[data-line="${FIRST_ACT}"]`);
    await expect(line?.querySelector('[data-verdict="promoted"]')).toBeInTheDocument();
    await expect(line).toHaveTextContent('Promoted into the record');
    // The foot says it too, for the act the controls hold.
    await expect(canvas.getAllByText('Promoted into the record')).toHaveLength(2);
  },
};

/** A promotion the record refused must never read as a promotion that landed, and the analyst
 * must meet the sentence without looking for it. */
export const ARefusedDecisionInterruptsAndSaysNothingWasWritten: Story = {
  args: {
    decision: {
      step: 'refused',
      changeId: FIRST_ACT,
      verdict: 'promoted',
      refusal: 'the act is decided already, and a decided act is frozen',
    },
  },
  play: async ({ canvas }) => {
    const said = canvas.getByRole('alert', { name: 'The record' });
    await expect(said).toHaveTextContent('Nothing was written');
    await expect(said).toHaveTextContent('a decided act is frozen');
    await expect(canvas.getByRole('button', { name: /Promote/ })).toBeEnabled();
  },
};

/** A doubt is the gravest sentence on this surface. It interrupts as a refusal does, and it
 * says neither that the act landed nor that nothing was written. */
export const ADoubtfulDecisionInterruptsAndReadsAsNeitherOutcome: Story = {
  args: {
    decision: {
      step: 'unknown',
      changeId: FIRST_ACT,
      verdict: 'promoted',
      doubt: 'The write service did not confirm the decision, and the act may have run whole.',
    },
  },
  play: async ({ canvas }) => {
    const said = canvas.getByRole('alert', { name: 'The record' });
    await expect(said).toHaveTextContent('It is not known whether the act was promoted.');
    await expect(said).toHaveTextContent('the act may have run whole');
    await expect(said).toHaveTextContent('Read the queue again before you decide.');
    await expect(said).not.toHaveTextContent('Nothing was written');
    await expect(canvas.queryByRole('status', { name: 'The record' })).toBeNull();
  },
};

/** A promotion that landed says one thing that is true of every act. A promoted deletion makes
 * no row, so the sentence names none. */
export const APromotionThatLandedSaysOnlyWhatIsTrueOfEveryAct: Story = {
  args: { decision: { step: 'decided', changeId: FIRST_ACT, verdict: 'promoted' } },
  play: async ({ canvas }) => {
    const said = canvas.getByRole('status', { name: 'The record' });
    await expect(said).toHaveTextContent(
      'The act is promoted. The record took it, and no door takes it back.',
    );
    await expect(said).not.toHaveTextContent('the row it made');
  },
};

/** While one verdict is going to the record, no second verdict is taken: the second would decide
 * an act on a record the first one has already moved. */
export const NoSecondVerdictIsTakenWhileOneIsGoing: Story = {
  args: { decision: { step: 'deciding', changeId: FIRST_ACT, verdict: 'promoted' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status', { name: 'The record' })).toHaveTextContent(
      'The promotion is going to the record.',
    );
    await expect(canvas.getByRole('button', { name: /Promote/ })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: /Reject/ })).toBeDisabled();
  },
};

/** An empty queue is said once, and not once in each of three panes. */
export const AnEmptyQueueIsSaidOnce: Story = {
  args: {
    queue: { subjects: [], verdicts: {} },
    examination: { subjectId: null, sort: 'confidence' },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-subject]')).toHaveLength(0);
    await expect(canvasElement.querySelectorAll('[data-change]')).toHaveLength(0);
    await expect(canvas.getAllByText(/Nothing waits for a decision/)).toHaveLength(1);
    // A control that orders nothing is not drawn.
    await expect(canvas.queryByRole('button', { name: 'weakest first' })).toBeNull();
  },
};

export const TheSurfaceHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark h-[720px] w-[1280px] bg-background text-foreground">
      <ReviewPage {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('list', { name: 'What is asked of this row' }),
    ).toBeInTheDocument();
  },
};

/** A verdict of one act must never read as the verdict of the act under the controls. The
 * sentence stays, because a doubt that goes away in silence loses the act that may have landed. */
export const ASentenceOfAnotherActSaysThatItIsOfAnotherAct: Story = {
  args: {
    decision: {
      step: 'unknown',
      changeId: 'an act that is not under the controls',
      verdict: 'promoted',
      doubt: 'The write service did not answer, and the act may have reached it.',
    },
  },
  play: async ({ canvas }) => {
    const said = canvas.getByRole('alert', { name: 'The record' });
    await expect(said).toHaveTextContent('This is about another act.');
    await expect(said).toHaveTextContent('It is not known whether the act was promoted.');
  },
};
