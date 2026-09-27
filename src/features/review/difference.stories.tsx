import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { Difference } from './difference';
import { focusOf } from './queue';
import { SAMPLE, sampleChange, sampleSubject } from './sample';

const CHANGE = sampleChange(SAMPLE.contestedRow);

const REMOVAL = focusOf(sampleSubject(SAMPLE.destroyedRow), null).current;

const meta = {
  component: Difference,
  args: { rows: CHANGE.rows, rowSources: CHANGE.rowSources },
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

/** A name change replaces the list that also backs the type and the location, so the card says
 * so on its own line, with the list that stands and the list that replaces it. */
export const ANameChangeShowsTheListItReplaces: Story = {
  args: {
    rows: [
      {
        key: 'Name',
        op: 'edit',
        standing: 'Old name',
        standingSources: CHANGE.sources,
        proposed: 'New name',
        proposedSources: [],
      },
    ],
    rowSources: {
      words: 'Sources of the name, the type and the map location',
      before: CHANGE.sources,
      after: [],
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText(/the type and the map location/)).toBeInTheDocument();
    const before = canvas.getByText('the list the record holds').parentElement;
    await expect(before?.querySelectorAll('button')).toHaveLength(CHANGE.sources.length);
    await expect(canvasElement.querySelectorAll('[data-row-sources]')).toHaveLength(1);
  },
};

/** Where the act leaves the list as it stands, no line says it is replaced. */
export const NoLineWhenTheListStands: Story = {
  args: { rowSources: null },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-row-sources]')).toBeNull();
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

// Origin of a number: the `--label` token of the dark theme.
const DARK_LABEL = 'oklch(0.63 0.008 215)';

export const TheDifferenceHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark w-[420px] bg-background p-2 text-foreground">
      <Difference {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const key = canvasElement.querySelector<HTMLElement>('[data-difference] span[title]');
    if (key === null) throw new Error('the difference draws no key');
    await expect(getComputedStyle(key).color).toBe(DARK_LABEL);
  },
};
