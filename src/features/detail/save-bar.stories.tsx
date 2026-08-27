import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import type { PendingEdit } from './draft';
import { SaveBar } from './save-bar';
import { saveWords } from './save';

const onSave = fn();

const PROPOSAL = 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12';

const CHANGED: PendingEdit = { ready: true, attrs: { coal_stock_t: { v: 43.5 } }, count: 1 };

const NOTHING: PendingEdit = { ready: false, reason: 'Nothing is changed.' };

const meta = {
  component: SaveBar,
  args: { sentence: saveWords({ step: 'idle' }, CHANGED), canSave: true, onSave },
} satisfies Meta<typeof SaveBar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const NothingChangedTakesNoSave: Story = {
  args: { sentence: saveWords({ step: 'idle' }, NOTHING), canSave: false },
  play: async ({ canvas }) => {
    const button = canvas.getByRole('button', { name: 'Save' });
    await expect(button).toBeDisabled();
    await expect(canvas.getByRole('status')).toHaveTextContent('Nothing is changed.');
  },
};

export const OneChangeIsSavedOnce: Story = {
  play: async ({ canvas }) => {
    onSave.mockClear();
    const button = canvas.getByRole('button', { name: 'Save' });
    await expect(button).toBeEnabled();

    await userEvent.click(button);
    await expect(onSave).toHaveBeenCalledTimes(1);
  },
};

// One act on the screen, two things in the record: the proposal, and the value it promoted.
export const ASignedActNamesItsProposal: Story = {
  args: {
    sentence: saveWords({ step: 'signed', proposalId: PROPOSAL }, NOTHING),
    canSave: false,
  },
  play: async ({ canvas }) => {
    const said = canvas.getByRole('status');
    await expect(said).toHaveTextContent('The value is signed manual.');
    await expect(said).toHaveTextContent(PROPOSAL);
  },
};

// The proposal is committed and the promotion refused it. The act is not lost, and the sentence
// names it, because that name is the only way back to it.
export const AnUndecidedActSaysItWasNotSigned: Story = {
  args: {
    sentence: saveWords(
      { step: 'undecided', proposalId: PROPOSAL, refusal: 'the target no longer exists' },
      NOTHING,
    ),
    canSave: false,
  },
  play: async ({ canvas }) => {
    const said = canvas.getByRole('status');
    await expect(said).toHaveTextContent('it was not signed');
    await expect(said).toHaveTextContent(PROPOSAL);
  },
};

export const ARefusalWritesNothing: Story = {
  args: {
    sentence: saveWords(
      { step: 'refused', refusal: 'the value of imo is not identifier' },
      NOTHING,
    ),
    canSave: false,
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Nothing was written.');
  },
};

// The change left the browser and no answer came back. The act may have run whole, so the bar
// states neither end and it asks for a second reading of the record.
export const AnUnknownResultTellsTheOperatorToReadAgain: Story = {
  args: {
    sentence: saveWords(
      {
        step: 'unknown',
        doubt: 'The write service did not answer, and the act may have reached it.',
      },
      NOTHING,
    ),
    canSave: false,
  },
  play: async ({ canvas }) => {
    const said = canvas.getByRole('status');
    await expect(said).toHaveTextContent(
      'It is not known whether the change was written. Read the record again before you act.',
    );
    await expect(said).toHaveTextContent(
      'The write service did not answer, and the act may have reached it.',
    );
    await expect(said).not.toHaveTextContent('signed');
    await expect(said).not.toHaveTextContent('Nothing was written.');
  },
};

export const AnActOnTheWayTakesNoSecondSave: Story = {
  args: { sentence: saveWords({ step: 'saving' }, CHANGED), canSave: false },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'The change is going to the record.',
    );
  },
};
