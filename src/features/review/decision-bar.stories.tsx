import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { DecisionBar } from './decision-bar';
import { decisionWords } from './decision-words';
import { unitPageOf } from './unit-page';
import { SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';
import { unitWords } from './unit-words';

const units = unitPageOf(UNIT_ANSWER)?.units ?? [];

const army = units.find((unit) => unit.id === SAMPLE_UNITS.army);
if (army === undefined) throw new Error('the sample holds no army');

const WORDS = unitWords(
  [
    {
      key: 'subordinate_to',
      label: 'subordinate to',
      inverseLabel: 'commands',
      takesInterval: true,
      retired: false,
    },
  ],
  [
    {
      key: 'military_unit',
      label: 'Military unit',
      colourLight: 'oklch(0.5 0.1 30)',
      colourDark: 'oklch(0.7 0.1 30)',
      retired: false,
    },
  ],
);

const onAct = fn();

const meta = {
  component: DecisionBar,
  args: { said: decisionWords(army, WORDS, null), aimed: false, state: { step: 'idle' }, onAct },
  render: (args) => (
    <div className="w-[640px] border border-border">
      <DecisionBar {...args} />
    </div>
  ),
} satisfies Meta<typeof DecisionBar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Before the click, Promote says what it writes, and Reject says what it rejects. */
export const EachControlSaysWhatItDoes: Story = {
  play: async ({ canvas }) => {
    onAct.mockClear();
    await expect(
      canvas.getByText(
        'Writes 5th Combined Arms Army (Military unit) and 1 relation. Source: GAB v1 ORBAT: ' +
          'military units and organisations of the v1 GeoPackage. You cannot undo this.',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByText('Rejects 5th Combined Arms Army and its 1 relation.'),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Promote' }));
    await expect(onAct).toHaveBeenCalledWith({ kind: 'promote' });
  },
};

/** A rejection needs a reason, and the reason "other" needs a note. */
export const ARejectionNeedsAReason: Story = {
  play: async ({ canvas }) => {
    onAct.mockClear();
    const reject = canvas.getByRole('button', { name: 'Reject' });
    await expect(reject).toBeDisabled();
    await userEvent.selectOptions(canvas.getByLabelText('Reason'), 'other');
    await expect(canvas.getByText('Write the reason in the note.')).toBeVisible();
    await expect(reject).toBeDisabled();
    await userEvent.type(canvas.getByLabelText('Note'), 'The page names a ferry.');
    await userEvent.click(reject);
    await expect(onAct).toHaveBeenCalledWith({
      kind: 'reject',
      reason: 'other',
      note: 'The page names a ferry.',
    });
  },
};

/** A refused promotion wrote nothing, and the sentence names the act that the record refused. */
export const ARefusalNamesTheAct: Story = {
  args: {
    state: {
      step: 'refused',
      unitId: SAMPLE_UNITS.army,
      refusal:
        'nothing of the unit is promoted, because its relation subordinate_to waits for ' +
        'Eastern Military District, which is not in the record',
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Nothing was written: nothing of the unit is promoted, because its relation ' +
        'subordinate_to waits for Eastern Military District, which is not in the record',
    );
  },
};

/** While a decision is on the way, no second decision can start. */
export const NoSecondDecisionWhileOneRuns: Story = {
  args: { state: { step: 'working', unitId: SAMPLE_UNITS.army } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Promote' })).toBeDisabled();
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'The decision is on the way to the record.',
    );
  },
};
