import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import type { Corpus } from '@/shared/read/model';

import { NodePane } from './node-pane';
import { changeLines, readQueue, type Subject } from './queue';
import { reviewSample, SAMPLE, sampleChange, sampleSubject } from './sample';

const SUBJECT = sampleSubject(SAMPLE.contestedRow);

const LINES = changeLines(SUBJECT, {});

const SETTLED = changeLines(SUBJECT, {
  [sampleChange(SAMPLE.contestedRow).id]: { verdict: 'promoted', reason: '' },
});

const onFocus = fn();

const meta = {
  component: NodePane,
  args: { subject: SUBJECT, lines: LINES, currentChangeId: LINES[0]?.id ?? null, onFocus },
  parameters: { layout: 'fullscreen' },
  // 20 rem, which is the width of the pane beside the queue.
  render: (args) => (
    <div className="h-[520px] w-80 p-2">
      <NodePane {...args} />
    </div>
  ),
} satisfies Meta<typeof NodePane>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The acts and the record they are judged against stand together, and the record folds away
 * where the analyst asks for the room. The fold is kept in the workspace, so it survives a
 * reload, and this story leaves it as it found it. */
export const TheRecordStandsBesideTheActsAndFoldsAway: Story = {
  play: async ({ canvas, canvasElement }) => {
    const fold = canvas.getByRole('button', { name: /The record as it stands/ });
    await expect(fold).toHaveAttribute('aria-expanded', 'true');
    await expect(canvasElement.querySelectorAll('[data-standing]').length).toBeGreaterThan(0);
    await expect(canvasElement.querySelectorAll('[data-line]')).toHaveLength(LINES.length);

    await userEvent.click(fold);
    await expect(fold).toHaveAttribute('aria-expanded', 'false');
    await expect(canvasElement.querySelectorAll('[data-standing]')).toHaveLength(0);

    await userEvent.click(fold);
    await expect(fold).toHaveAttribute('aria-expanded', 'true');
  },
};

/** A line of an act carries its kind as a glyph, and the word of that kind stays inside the one
 * mark, for a reader who hears the line. No column of the line prints it a second time. */
export const AnActLineCarriesItsKindAsAGlyphAndKeepsTheWord: Story = {
  play: async ({ canvas, canvasElement }) => {
    const mark = canvasElement.querySelector('[data-line] [data-kind]');
    await expect(mark?.querySelector('svg')).not.toBeNull();
    await expect(mark).toHaveAttribute('title', 'Modification');
    const said = canvas.getAllByText('Modification');
    await expect(said.length).toBeGreaterThan(0);
    for (const word of said) {
      await expect(word.closest('[data-kind]')).not.toBeNull();
    }
  },
};

/** Two acts that read one key carry one rule, so the pair reads as a bracket and not as two rows
 * that happen to sit together. An act that reads no contested key carries none. */
export const TwoContestedActsCarryOneRuleAndKeepTheirWord: Story = {
  play: async ({ canvas, canvasElement }) => {
    const ruled = canvasElement.querySelectorAll('[data-line][data-contested="true"]');
    await expect(ruled).toHaveLength(2);
    const quiet = canvasElement.querySelectorAll('[data-line]:not([data-contested])');
    await expect(quiet.length).toBeGreaterThan(0);
    const marked = canvas.getAllByTitle('Another act of this row reads a key that this one reads');
    await expect(marked).toHaveLength(2);
    await expect(canvas.getAllByText('contested')).toHaveLength(marked.length);
  },
};

/** The pane draws one line for each act the subject carries, and it names each act on its line. */
export const EveryActOfTheSubjectDrawsOneLine: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-line]')).toHaveLength(
      SUBJECT.changes.length,
    );
    for (const change of SUBJECT.changes) {
      await expect(canvasElement.querySelector(`[data-line="${change.id}"]`)).not.toBeNull();
    }
  },
};

/** The verdict is the output of the screen, so it is a mark and not the quietest text on it. */
export const ASettledActCarriesAMarkInPlaceOfItsConfidence: Story = {
  args: { lines: SETTLED },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Promoted into the record')).toBeInTheDocument();
  },
};

const UNHELD = 'doc_0000ff';

const STANDS_ON_AN_UNHELD_DOCUMENT: Corpus = {
  ...reviewSample,
  entities: reviewSample.entities.map((entity) =>
    entity.id === SAMPLE.contestedRow
      ? { ...entity, attrs: { ...entity.attrs, berth_count: { v: 3, src: [UNHELD] } } }
      : entity,
  ),
};

function unheldSubject(): Subject {
  const held = readQueue(STANDS_ON_AN_UNHELD_DOCUMENT, null).find(
    (subject) => subject.id === SAMPLE.contestedRow,
  );
  if (held === undefined) throw new Error('The terminal waits in no subject of the queue.');
  return held;
}

export const AStandingValueOnAnUnheldDocumentShowsItMissing: Story = {
  args: { subject: unheldSubject() },
  play: async ({ canvasElement }) => {
    const row = canvasElement.querySelector('[data-standing="berth_count"]');
    const badge = row?.querySelector('[data-band]');
    await expect(badge).toHaveAttribute('data-band', 'missing');
  },
};

// Origin of a number: the `--label` token of the dark theme.
const DARK_LABEL = 'oklch(0.63 0.008 215)';

export const ThePaneHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark h-[520px] w-80 bg-background p-2 text-foreground">
      <NodePane {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const type = canvas.getByRole('heading', { level: 1 }).querySelector('span:last-child');
    if (type === null) throw new Error('the pane names no type');
    await expect(getComputedStyle(type).color).toBe(DARK_LABEL);
  },
};
