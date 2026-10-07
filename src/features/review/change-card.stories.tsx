import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { ChangeCard } from './change-card';
import { focusOf } from './queue';
import { SAMPLE, sampleChange, sampleSubject } from './sample';

const CONTESTED = sampleSubject(SAMPLE.contestedRow);

const CHANGE = sampleChange(SAMPLE.contestedRow);

const REMOVAL = sampleChange(SAMPLE.destroyedRow);

const BESIDE = focusOf(CONTESTED, null).beside[0] ?? CHANGE;

/** The record does not hold `berth_length_m`, so this act adds it, whatever its operation
 * is called. */
const ADDITION = CONTESTED.changes.find((change) => change.kind === 'add') ?? CHANGE;

const meta = {
  component: ChangeCard,
  args: { change: CHANGE, current: true, passages: { state: 'held', passages: [], dispute: null } },
  parameters: { layout: 'fullscreen' },
  // The width of one card when two stand side by side. Every mark must survive it.
  render: (args) => (
    <div className="flex h-[420px] w-[360px] p-2">
      <ChangeCard {...args} />
    </div>
  ),
} satisfies Meta<typeof ChangeCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The card draws no confidence, no rating and no badge of the author: the product removed
 * them, and a mark with no meaning misleads the reader. */
export const TheCardDrawsNoConfidenceNoRatingAndNoAuthorBadge: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-confidence]')).toBeNull();
    await expect(canvasElement.querySelector('[data-origin]')).toBeNull();
    await expect(canvasElement.querySelector('[data-band]')).toBeNull();
    await expect(canvasElement.querySelector('[data-hole]')).toBeNull();
    await expect(canvas.queryByText(/^machine$/)).toBeNull();
    await expect(canvas.queryByText(/not rated|threshold/)).toBeNull();
  },
};

/** An act that only names keys the record does not hold is an addition. The name of the
 * operation says `update`, and what the act does is what the card draws. */
export const AnActThatOnlyAddsKeysReadsAsAnAddition: Story = {
  args: {
    change: ADDITION,
    current: true,
    passages: { state: 'held', passages: [], dispute: null },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Addition')).toBeInTheDocument();
    await expect(canvas.queryByText('Modification')).toBeNull();
    await expect(canvasElement.querySelector('[data-kind="add"]')).not.toBeNull();
    await expect(canvasElement.querySelectorAll('[data-op="edit"]')).toHaveLength(0);
  },
};

/** A disputed act says so on its card, in one word beside the mark. */
export const ADisputedActSaysDisputed: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-disputed]')).not.toBeNull();
    await expect(canvas.getByText('disputed')).toBeInTheDocument();
    await expect(canvas.getByText('A check disputes this act.')).toBeInTheDocument();
  },
};

/** A disputed act says why, in the words that the check recorded: the value that its passage does
 * not state, or the verdict of the checker and its reason. */
export const ADisputedActSaysWhy: Story = {
  args: {
    passages: {
      state: 'held',
      passages: [],
      dispute: 'no cited passage states attrs.flag "Panama"; the checker did not answer',
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const why = canvasElement.querySelector('[data-dispute]');
    await expect(why).not.toBeNull();
    await expect(
      canvas.getByText('no cited passage states attrs.flag "Panama"; the checker did not answer'),
    ).toBeInTheDocument();
  },
};

/** With no recorded reason, the card states no reason, and still says that the act is disputed. */
export const ADisputeWithNoRecordedReasonStatesNone: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-dispute]')).toBeNull();
    await expect(canvas.getByText('disputed')).toBeInTheDocument();
  },
};

/** An act that no check disputes draws no mark of a dispute. */
export const AnUndisputedActDrawsNoDisputeMark: Story = {
  args: { change: ADDITION },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-disputed]')).toBeNull();
    await expect(canvas.queryByText('disputed')).toBeNull();
  },
};

/** The card the controls act on says so in its state, and never in a printed word: at the width
 * of two cards a word is clipped. The sentence stays for a reader who cannot see the mark. */
export const TheCurrentCardIsMarkedByItsStateAndNotByAPrintedWord: Story = {
  play: async ({ canvas, canvasElement }) => {
    const card = canvasElement.querySelector('[data-change]');
    await expect(card).toHaveAttribute('aria-current', 'true');
    await expect(canvas.queryByText(/^(Current|Selected|Open)$/)).toBeNull();
    await expect(canvas.getByText('The controls act on this one')).toBeInTheDocument();
  },
};

/** An update carries its documents on its own rows, so the card shows them once and not twice. */
export const AnUpdateShowsItsDocumentsOnItsRowsOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('The documents this act stands on')).toBeNull();
  },
};

export const ACardReadBesideAnotherCarriesNoRule: Story = {
  args: { change: BESIDE, current: false },
  play: async ({ canvas, canvasElement }) => {
    const card = canvasElement.querySelector('[data-change]');
    await expect(card).not.toHaveAttribute('aria-current');
    await expect(canvas.getByText('Read beside the act under the controls')).toBeInTheDocument();
  },
};

export const ADeletionNamesTheRowItDestroys: Story = {
  args: { change: REMOVAL, current: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Deletion')).toBeInTheDocument();
    const taken = canvasElement.querySelectorAll('[data-op="remove"]');
    await expect(taken.length).toBeGreaterThan(0);
    await expect(canvasElement.querySelectorAll('[data-op="edit"]')).toHaveLength(0);
    const cited = canvas.getByText('The documents this act stands on').parentElement;
    await expect(cited).not.toBeNull();
    await expect(
      within(cited ?? canvasElement).getByRole('button', { name: 'Vessel movement log, scanned' }),
    ).toBeInTheDocument();
  },
};

// Origin of a number: the `--dissent` token of the dark theme.
const DARK_DISSENT = 'oklch(0.7 0.17 28)';

export const TheCardHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark flex h-[420px] w-[360px] bg-background p-2 text-foreground">
      <ChangeCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const disputed = canvasElement.querySelector<HTMLElement>('[data-disputed]');
    if (disputed === null) throw new Error('the card draws no mark of a dispute');
    await expect(getComputedStyle(disputed).color).toBe(DARK_DISSENT);
  },
};
