import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { readQueue } from './queue';
import { ReviewPage } from './review-page';
import { ReviewSurface } from './review-surface';
import { SAMPLE, reviewSample } from './sample';

const onView = fn();

const QUEUE = (
  <ReviewPage
    queue={{ subjects: readQueue(reviewSample), verdicts: {} }}
    examination={{ subjectId: SAMPLE.contestedRow, sort: 'confidence' }}
    decision={{ step: 'idle' }}
    passages={{ state: 'held', byAct: {} }}
    onAct={fn()}
  />
);

const meta = {
  component: ReviewSurface,
  args: { view: 'queue', onView, queue: QUEUE, decided: [] },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-[720px] w-[1280px]">
      <ReviewSurface {...args} />
    </div>
  ),
} satisfies Meta<typeof ReviewSurface>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The history is one press away from the queue, and the press names the page it opens. */
export const TheHistoryIsReachedFromTheQueue: Story = {
  play: async ({ canvas }) => {
    const pages = canvas.getByRole('navigation', { name: 'Review pages' });
    await expect(pages).toBeInTheDocument();
    await userEvent.click(canvas.getByRole('button', { name: 'Decided' }));
    await expect(onView).toHaveBeenCalledWith('decided');
  },
};

/** The queue stays mounted under the history, so a visit to the history ends no pass. */
export const TheQueueOutlivesAVisitToTheHistory: Story = {
  args: { view: 'decided' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'What the record decided' })).toBeVisible();
    await expect(canvasElement.querySelector('[data-subject]')).not.toBeNull();
    await expect(
      canvas.queryByRole('navigation', { name: 'What waits for a decision' }),
    ).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Decided' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};
