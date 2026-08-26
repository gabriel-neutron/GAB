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

/** A verdict of the pass reaches the line of the act, and it writes nothing to the record. */
export const AVerdictOfThePassReachesTheLineOfTheAct: Story = {
  args: {
    queue: { subjects: SUBJECTS, verdicts: { [FIRST_ACT]: { verdict: 'promoted', reason: '' } } },
  },
  play: async ({ canvas, canvasElement }) => {
    const line = canvasElement.querySelector(`[data-line="${FIRST_ACT}"]`);
    await expect(line?.querySelector('[data-verdict="promoted"]')).toBeInTheDocument();
    await expect(line).toHaveTextContent('Promoted on this pass');
    // The foot says it too, for the act the controls hold. The record is written nowhere.
    await expect(canvas.getAllByText('Promoted on this pass')).toHaveLength(2);
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
