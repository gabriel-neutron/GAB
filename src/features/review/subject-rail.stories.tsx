import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

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

const SETTLED_TERMINAL_ACT = 'aa000001-0000-4000-8000-000000000002';

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
    await expect(canvasElement.querySelectorAll('[data-subject]')).toHaveLength(3);
    const terminal = canvasElement.querySelector(`[data-subject="${SAMPLE.contestedRow}"]`);
    const counts = [...(terminal?.querySelectorAll('[data-count]') ?? [])].map((held) => [
      held.getAttribute('data-count'),
      held.querySelector('.font-mono')?.textContent,
    ]);
    await expect(counts).toEqual([
      ['add', '2'],
      ['edit', '2'],
    ]);
  },
};

export const ARowTakesTheHueOfItsCostliestKind: Story = {
  play: async ({ canvasElement }) => {
    const rule = (id: string) =>
      canvasElement.querySelector(`[data-subject="${id}"]`)?.getAttribute('data-rule');
    await expect(rule(SAMPLE.destroyedRow)).toBe('delete');
    await expect(rule(SAMPLE.contestedRow)).toBe('add');
  },
};

export const ASettledActFillsTheTrackOfItsSubject: Story = {
  args: {
    queue: {
      rows: railRows(SUBJECTS, {
        [SETTLED_TERMINAL_ACT]: { verdict: 'deferred', reason: 'The second reading is not in yet' },
      }),
      currentId: null,
      sort: 'confidence',
    },
  },
  play: async ({ canvasElement }) => {
    const terminal = canvasElement.querySelector(`[data-subject="${SAMPLE.contestedRow}"]`);
    const track = terminal?.querySelector('[style]');
    await expect(track instanceof HTMLElement ? track.style.width : null).toBe('25%');
    const vessel = canvasElement.querySelector(`[data-subject="${SAMPLE.destroyedRow}"]`);
    await expect(vessel?.querySelector('[style]')).toBeNull();
  },
};

export const APressOnARowOpensItsSubject: Story = {
  play: async ({ canvasElement }) => {
    const vessel = canvasElement.querySelector(`[data-subject="${SAMPLE.destroyedRow}"]`);
    if (!(vessel instanceof HTMLElement)) throw new Error('The rail draws no VESSEL row.');
    await userEvent.click(vessel);
    await expect(onSelect).toHaveBeenCalledWith(SAMPLE.destroyedRow);
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
    const oldest = canvas.getByRole('button', { name: 'oldest first' });
    await expect(oldest).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(oldest);
    await expect(onSort).toHaveBeenCalledWith('oldest');
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
