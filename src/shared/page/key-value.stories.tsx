import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { KeyValue } from './key-value';

const meta = {
  component: KeyValue,
  args: {
    entries: [
      { key: 'Valid from', value: '2024-02-01', figure: true },
      { key: 'Valid to', value: null, figure: true },
      { key: 'Label', value: 'Reported by a single source' },
    ],
  },
} satisfies Meta<typeof KeyValue>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AnAbsentValueKeepsItsKeyAndABlankCell: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('term')[1]).toHaveTextContent('Valid to');
    await expect(canvas.getAllByRole('definition')[1]).toHaveTextContent('');
  },
};

export const EachValueFollowsItsKey: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('definition')[0]).toHaveTextContent('2024-02-01');
  },
};
