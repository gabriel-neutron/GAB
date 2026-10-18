import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { DataTable, type DataColumn } from './data-table';

interface Node {
  readonly name: string;
  readonly stage: string | null;
  readonly sources: number;
}

const COLUMNS: readonly DataColumn<Node>[] = [
  { key: 'name', header: 'Entity', cell: (row) => row.name },
  { key: 'stage', header: 'Stage', cell: (row) => row.stage },
  { key: 'sources', header: 'Sources', cell: (row) => row.sources, figure: 'count' },
];

const meta = {
  component: DataTable<Node>,
  args: {
    name: 'Critical nodes',
    columns: COLUMNS,
    rows: [
      { id: 'a', row: { name: 'Ust-Luga terminal', stage: 'Export', sources: 4 } },
      { id: 'b', row: { name: 'Primorsk port', stage: null, sources: 12 } },
    ],
    empty: 'The release holds no critical node.',
  },
} satisfies Meta<typeof DataTable<Node>>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EachRowShowsEachColumn: Story = {
  play: async ({ canvas }) => {
    const table = canvas.getByRole('table', { name: 'Critical nodes' });
    await expect(table).toBeVisible();
    await expect(canvas.getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Entity',
      'Stage',
      'Sources',
    ]);
    await expect(canvas.getByRole('cell', { name: '12' })).toBeVisible();
  },
};

export const AnAbsentValueIsABlankCell: Story = {
  play: async ({ canvas }) => {
    const row = canvas.getByRole('row', { name: /Primorsk port/ });
    await expect(row.querySelectorAll('td')[1]?.textContent).toBe('');
  },
};

export const NoRowGivesOneSentence: Story = {
  args: { rows: [] },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('table')).toBeNull();
    await expect(canvas.getByText('The release holds no critical node.')).toBeVisible();
  },
};
