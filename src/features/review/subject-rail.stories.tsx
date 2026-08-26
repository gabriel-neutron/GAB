import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';

import type { SubjectRow } from './queue';
import { railRows, readQueue, sortSubjects } from './queue';
import { SAMPLE, reviewSample } from './sample';
import { SubjectRail } from './subject-rail';

/** Longer than the 18 rem of the rail at every text size of the theme, so the rail cuts it. */
const LONG_LABEL =
  'Maasvlakte bulk terminal, berth 7, north quay coal and iron ore handling installation';

const CUT: SubjectRow = {
  id: SAMPLE.contestedRow,
  label: LONG_LABEL,
  counts: [{ kind: 'edit', count: 2, words: 'Modification' }],
  rule: 'edit',
  settledFill: 0,
  name: `${LONG_LABEL}, Entity. 2 Modification. 2 of 2 waiting, and two acts contest one key`,
  contested: true,
};

const SUBJECTS = sortSubjects(readQueue(reviewSample, null), 'confidence');

const ROWS = railRows(SUBJECTS, {});

const onSelect = fn();

const onSort = fn();

const meta = {
  component: SubjectRail,
  args: {
    queue: { rows: ROWS, currentId: ROWS[0]?.id ?? null, sort: 'confidence' },
    onSelect,
    onSort,
  },
  parameters: { layout: 'fullscreen' },
  // 18 rem, which is the width of the queue beside the two other panes.
  render: (args) => (
    <div className="h-[520px] w-72 p-2">
      <SubjectRail {...args} />
    </div>
  ),
} satisfies Meta<typeof SubjectRail>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The queue lists what is being changed, and never one act on its own. */
export const TheQueueListsSubjectsAndCountsTheirActs: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-subject]')).toHaveLength(ROWS.length);
  },
};

/** A row is one line, so the mark carries the glance and the name carries the words. */
export const AContestedSubjectIsMarkedAndItsNameSaysSo: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: /two acts contest one key/ }),
    ).toBeInTheDocument();
  },
};

/** A label the rail cuts never drops the value: the whole name is under the pointer, and the
 * accessible name of the row carries it too. */
export const ALabelThatIsCutKeepsItsWholeValue: Story = {
  args: { queue: { rows: [CUT], currentId: CUT.id, sort: 'confidence' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByTitle(LONG_LABEL)).toHaveTextContent(LONG_LABEL);
    await expect(canvas.getByRole('button', { name: CUT.name })).toBeInTheDocument();
  },
};

/** An empty queue says the count and the reason once, and it draws no control that sorts it. */
export const AnEmptyQueueSaysTheCountAndTheReason: Story = {
  args: { queue: { rows: [], currentId: null, sort: 'confidence' } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-subject]')).toHaveLength(0);
    await expect(canvas.getByText(/Nothing waits for a decision/)).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: 'weakest first' })).toBeNull();
  },
};

export const TheOrderOfTheQueueIsAControl: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'weakest first' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(canvas.getByRole('button', { name: 'oldest first' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  },
};

export const TheRailHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark h-[520px] w-72 bg-background p-2 text-foreground">
      <SubjectRail {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('navigation', { name: 'What waits for a decision' }),
    ).toBeInTheDocument();
  },
};
