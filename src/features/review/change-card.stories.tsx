import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

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
  args: { change: CHANGE, current: true },
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

/** Only what THIS act lacks is drawn. A hole every act carries tells the reader nothing; the
 * disagreement with no argument is real, and it is drawn. */
export const OnlyWhatThisActLacksIsDrawn: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-hole="argument"]')).not.toBeNull();
    await expect(canvas.queryByText(/quoted text/)).toBeNull();
    // The whole reason survives for a reader, and the card holds no paragraph of it.
    await expect(canvas.getByText(/neither side of it/)).toBeInTheDocument();
  },
};

/** An act that only names keys the record does not hold is an addition. The name of the
 * operation says `update`, and what the act does is what the card draws. */
export const AnActThatOnlyAddsKeysReadsAsAnAddition: Story = {
  args: { change: ADDITION, current: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Addition')).toBeInTheDocument();
    await expect(canvas.queryByText('Modification')).toBeNull();
    await expect(canvasElement.querySelector('[data-kind="add"]')).not.toBeNull();
    await expect(canvasElement.querySelectorAll('[data-op="edit"]')).toHaveLength(0);
  },
};

/** The reason the act is here is a mark, and it is stated once and not twice. */
export const TheRoutingIsAMarkAndItIsStatedOnce: Story = {
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-routing]')).toHaveLength(1);
  },
};

/** The self-report of the machine is a track and a figure, and never the word `confidence`. */
export const TheConfidenceIsATrackAndAFigure: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-confidence]')).not.toBeNull();
    await expect(canvas.queryByText(/^Confidence /)).toBeNull();
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
  },
};

export const TheCardHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark flex h-[420px] w-[360px] bg-background p-2 text-foreground">
      <ChangeCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-change]')).not.toBeNull();
  },
};
