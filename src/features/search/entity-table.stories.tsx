import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';

import { rowsOf } from './entity-rows';
import { EntityTable } from './entity-table';

const meta = {
  component: EntityTable,
  args: {
    rows: rowsOf(corpus.entities),
    hrefOf: (entityId: string) => `/entity/${encodeURIComponent(entityId)}`,
  },
} satisfies Meta<typeof EntityTable>;

export default meta;

type Story = StoryObj<typeof meta>;

const namesOf = (rowheaders: readonly HTMLElement[]): (string | null)[] =>
  rowheaders.map((one) => one.textContent);

/** A header sorts ascending, then descending, and it states the order in `aria-sort`. */
export const AHeaderSortsBothWays: Story = {
  play: async ({ canvas }) => {
    const header = canvas.getByRole('columnheader', { name: /^Entity/ });
    await expect(header).toHaveAttribute('aria-sort', 'ascending');
    const up = namesOf(canvas.getAllByRole('rowheader'));
    await userEvent.click(within(header).getByRole('button'));
    await expect(header).toHaveAttribute('aria-sort', 'descending');
    await expect(namesOf(canvas.getAllByRole('rowheader'))).toEqual([...up].reverse());
  },
};

/** The text filter narrows the rows and the status line says the count. */
export const TheTextFilterNarrowsTheRows: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Filter by name' }), 'northern');
    await expect(canvas.getAllByRole('rowheader').length).toBeLessThan(corpus.entities.length);
    await expect(canvas.getByRole('status')).toHaveTextContent(`of ${corpus.entities.length}`);
  },
};

/** Select all ticks every filtered row, and the download buttons wake up. */
export const SelectAllTicksTheFilteredRows: Story = {
  play: async ({ canvas }) => {
    const csv = canvas.getByRole('button', { name: /Download selection \(CSV\)/ });
    await expect(csv).toBeDisabled();
    await userEvent.click(canvas.getByRole('checkbox', { name: 'Select all filtered entities' }));
    await expect(csv).toBeEnabled();
    await expect(canvas.getByRole('status')).toHaveTextContent(
      `${corpus.entities.length} selected`,
    );
  },
};
