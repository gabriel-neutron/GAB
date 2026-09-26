import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import type { DecidedAct } from '@/shared/read/decided-acts';

import { readDecided } from './decided';
import { DecidedPage } from './decided-page';

const DECIDED: readonly DecidedAct[] = corpus.proposals.flatMap(
  ({ status, decidedAt, decidedBy, ...act }) =>
    status === 'pending' || decidedAt === null || decidedBy === null
      ? []
      : [{ act, verdict: status, decidedAt, decidedBy }],
);

const ROWS = readDecided(corpus, DECIDED);

const meta = {
  component: DecidedPage,
  args: { rows: ROWS },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-[720px] w-[1280px]">
      <DecidedPage {...args} />
    </div>
  ),
} satisfies Meta<typeof DecidedPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each decided act stands on one row, with its verdict, what it changed, the hour and the name
 * that signed it, the latest decision first. */
export const EachDecidedActStandsOnOneRow: Story = {
  play: async ({ canvas, canvasElement }) => {
    const rows = canvasElement.querySelectorAll('[data-decided]');
    await expect(rows).toHaveLength(3);
    await expect(rows[0]).toHaveTextContent('2026-07-25 07:30 UTC');
    await expect(rows[0]?.querySelector('[data-verdict="promoted"]')).toBeInTheDocument();
    await expect(rows[2]?.querySelector('[data-verdict="rejected"]')).toBeInTheDocument();
    await expect(canvas.getByRole('columnheader', { name: 'Signed as' })).toBeInTheDocument();
  },
};

/** The page offers no control. A decided act is frozen, and the page says so. */
export const NoDecidedActCanBeOpenedAgain: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryAllByRole('button')).toHaveLength(0);
    await expect(canvas.getByText(/no door opens it again/)).toBeInTheDocument();
    await expect(canvas.getByText(/A hold is not listed/)).toBeInTheDocument();
    await expect(canvas.getByText(/does not prove that a person decided/)).toBeInTheDocument();
  },
};

export const AnEmptyHistoryIsSaid: Story = {
  args: { rows: [] },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-decided]')).toHaveLength(0);
    await expect(canvas.getByText('The record holds no decided act.')).toBeInTheDocument();
  },
};

export const TheHistoryHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark h-[720px] w-[1280px] bg-background text-foreground">
      <DecidedPage {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('table')).toBeInTheDocument();
  },
};
