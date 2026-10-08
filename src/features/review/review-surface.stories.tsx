import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { decidedRows } from './decided';
import { DecidedPage } from './decided-page';
import { DECIDED_SAMPLE } from './decided-sample';
import { ReviewSurface } from './review-surface';
import { NO_FILTER } from './review-workspace';
import { unitPageOf } from './unit-page';
import { UNIT_ANSWER } from './unit-sample';
import { unitWords } from './unit-words';
import { UnitsPage } from './units-page';

const onView = fn();

const QUEUE = (
  <UnitsPage
    view={{
      state: 'held',
      queue: {
        units: unitPageOf(UNIT_ANSWER, null)?.units ?? [],
        total: 1082,
        matched: 1082,
        before: 0,
        filtered: false,
        more: 'ready',
      },
      filter: NO_FILTER,
      choices: { groups: [], documents: [], proposers: [] },
      linked: { state: 'none' },
      decision: { step: 'idle' },
    }}
    selectedId=""
    words={unitWords([], [])}
    onAct={fn()}
  />
);

const DECIDED = (
  <DecidedPage
    view={{ state: 'held', rows: decidedRows(DECIDED_SAMPLE), more: 'none' }}
    onMore={fn()}
  />
);

const meta = {
  component: ReviewSurface,
  args: { view: 'queue', onView, queue: QUEUE, groups: null, decided: DECIDED },
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

/** The queue stays mounted under the history, so a visit to the history keeps the pages read. */
export const TheQueueOutlivesAVisitToTheHistory: Story = {
  args: { view: 'decided' },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('region', { name: 'What the operator decided' })).toBeVisible();
    await expect(canvasElement.querySelector('[data-unit]')).not.toBeNull();
    await expect(
      canvas.queryByRole('navigation', { name: 'Units that wait for a decision' }),
    ).toBeNull();
    await expect(canvas.getByRole('button', { name: 'Decided' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  },
};
