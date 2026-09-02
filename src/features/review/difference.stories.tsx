import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { Difference } from './difference';
import { focusOf } from './queue';
import { SAMPLE, sampleChange, sampleSubject } from './sample';

const CHANGE = sampleChange(SAMPLE.contestedRow);

const REMOVAL = focusOf(sampleSubject(SAMPLE.destroyedRow), null).current;

const meta = {
  component: Difference,
  args: { rows: CHANGE.rows },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="w-[420px] p-2">
      <Difference {...args} />
    </div>
  ),
} satisfies Meta<typeof Difference>;

export default meta;

type Story = StoryObj<typeof meta>;

/** No header names a column. The mark before the key says what the act does to it. */
export const NoHeaderNamesAColumn: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByText('Stands today')).toBeNull();
    await expect(canvas.queryByText('Asked')).toBeNull();
    await expect(canvasElement.querySelector('[data-op="edit"]')).not.toBeNull();
  },
};

/** Each side carries the documents that hold that side up, and the two are never one list: the
 * side the record holds and the side the act asks for carry one badge each. */
export const EachSideCarriesItsOwnSource: Story = {
  play: async ({ canvas }) => {
    const standing = canvas.getByText('the value the record holds').parentElement;
    const proposed = canvas.getByText('the value this act asks for').parentElement;
    await expect(standing?.querySelectorAll('button')).toHaveLength(1);
    await expect(proposed?.querySelectorAll('button')).toHaveLength(1);
    await expect(canvas.getAllByRole('button')).toHaveLength(2);
  },
};

/** A key the record does not hold is an addition, and it draws nothing on the left. */
export const AKeyTheRecordDoesNotHoldIsAnAddition: Story = {
  args: {
    rows: [
      {
        key: 'berth_length_m',
        op: 'add',
        standing: null,
        standingSources: [],
        proposed: '340',
        proposedSources: [],
      },
    ],
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-op="add"]')).not.toBeNull();
    await expect(canvas.queryByText('—')).toBeNull();
    await expect(canvas.getByText('340')).toBeInTheDocument();
  },
};

/** A key an act takes away carries the hue of the act that destroys, and no arrow. */
export const AKeyAnActTakesAwayIsMarked: Story = {
  args: { rows: REMOVAL?.rows ?? [] },
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('[data-op="remove"]');
    await expect(rows.length).toBeGreaterThan(0);
  },
};

export const TheDifferenceHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark w-[420px] bg-background p-2 text-foreground">
      <Difference {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-difference]')).not.toBeNull();
  },
};
