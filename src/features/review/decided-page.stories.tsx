import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { decidedRows } from './decided';
import { DecidedPage } from './decided-page';
import { DECIDED_SAMPLE, RULE_DECIDED } from './decided-sample';

const ROWS = decidedRows(DECIDED_SAMPLE);

const meta = {
  component: DecidedPage,
  args: { view: { state: 'held', rows: ROWS, unread: 0, why: null, more: 'none' }, onMore: fn() },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-[720px] w-[1280px]">
      <DecidedPage {...args} />
    </div>
  ),
} satisfies Meta<typeof DecidedPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each decided act stands on one row, promoted or rejected, the latest decision first. */
export const EachDecidedActStandsOnOneRow: Story = {
  play: async ({ canvasElement }) => {
    const rows = canvasElement.querySelectorAll('[data-decided]');
    await expect(rows).toHaveLength(3);
    await expect(rows[0]).toHaveTextContent('2026-10-07 14:02 UTC');
    await expect(rows[0]?.querySelector('[data-verdict="promoted"]')).toBeInTheDocument();
    await expect(rows[1]?.querySelector('[data-verdict="rejected"]')).toBeInTheDocument();
  },
};

/** A rejection shows its reason and its note. */
export const ARejectionShowsItsReasonAndNote: Story = {
  play: async ({ canvasElement }) => {
    const [, rejected] = canvasElement.querySelectorAll('[data-decided]');
    await expect(rejected).toHaveTextContent(
      'Not in the source: The page names the region, not a body.',
    );
  },
};

/** The decided history says "validated manually" for the operator, and a group action as a group
 * action. */
export const TheDecisionModeIsNamed: Story = {
  play: async ({ canvas, canvasElement }) => {
    const rows = canvasElement.querySelectorAll('[data-decided]');
    await expect(rows[0]).toHaveTextContent('validated manually by the operator, group action');
    await expect(rows[2]).toHaveTextContent('validated manually by the operator');
    await expect(canvas.getByRole('columnheader', { name: 'Decided by' })).toBeInTheDocument();
    await expect(canvas.queryByRole('columnheader', { name: 'Keys' })).not.toBeInTheDocument();
    await expect(canvas.queryByText(/A hold is not listed/)).not.toBeInTheDocument();
  },
};

/** A decision of a rule names the rule, and no word makes it a decision of the operator. */
export const ARuleDecisionNamesTheRule: Story = {
  args: {
    view: {
      state: 'held',
      rows: decidedRows([RULE_DECIDED]),
      unread: 0,
      why: null,
      more: 'none',
    },
  },
  play: async ({ canvasElement }) => {
    const [row] = canvasElement.querySelectorAll('[data-decided]');
    await expect(row).toHaveTextContent('accepted by the rule strong sources, version 1');
    await expect(row).not.toHaveTextContent(/operator/u);
  },
};

/** A long history is read page by page. */
export const TheNextActsAreReadOnDemand: Story = {
  args: { view: { state: 'held', rows: ROWS, unread: 0, why: null, more: 'ready' } },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Read the next acts' }));
    await expect(args.onMore).toHaveBeenCalledOnce();
  },
};

/** While the next acts are read, the control says so and takes no second click. */
export const TheNextActsAreBeingRead: Story = {
  args: { view: { state: 'held', rows: ROWS, unread: 0, why: null, more: 'reading' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Reading the next acts' })).toBeDisabled();
  },
};

/** An act that the page cannot read is counted, and the other acts stay. */
export const AnUnreadActIsCounted: Story = {
  args: {
    view: {
      state: 'held',
      rows: ROWS,
      unread: 1,
      why: 'The decided acts cannot be read: the database did not answer',
      more: 'none',
    },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-decided]')).toHaveLength(3);
    await expect(canvas.getByText(/^1 decided act cannot be read by this page/u)).toBeVisible();
    await expect(
      canvas.getByText('The decided acts cannot be read: the database did not answer'),
    ).toBeVisible();
  },
};

export const AnEmptyHistoryIsSaid: Story = {
  args: { view: { state: 'held', rows: [], unread: 0, why: null, more: 'none' } },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-decided]')).toHaveLength(0);
    await expect(canvas.getByText('No act was decided yet.')).toBeInTheDocument();
  },
};

/** With no write service, the page says why it shows nothing. */
export const APrivateHistorySaysWhy: Story = {
  args: { view: { state: 'private', why: 'The decided acts are private.' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The decided acts are private.')).toBeInTheDocument();
  },
};

// Origin of a number: the `--label` token of the dark theme.
const DARK_LABEL = 'oklch(0.63 0.008 215)';

export const TheHistoryHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark h-[720px] w-[1280px] bg-background text-foreground">
      <DecidedPage {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const head = canvas.getByRole('table').querySelector('thead');
    if (head === null) throw new Error('the table draws no head');
    await expect(getComputedStyle(head).color).toBe(DARK_LABEL);
  },
};
