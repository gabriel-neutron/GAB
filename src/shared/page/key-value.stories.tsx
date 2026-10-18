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
    const key = canvas.getByText('Valid to');
    await expect(key.tagName).toBe('DT');
    await expect(key.nextElementSibling?.textContent).toBe('');
  },
};

export const EachValueFollowsItsKey: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Valid from').nextElementSibling?.textContent).toBe('2024-02-01');
  },
};
