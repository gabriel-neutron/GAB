import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { TypeCountList } from './type-count-list';

const meta = {
  component: TypeCountList,
  args: {
    counts: [
      { type: 'refinery', label: 'Refinery', total: 46, onMap: 28 },
      { type: 'port', label: 'Port', total: 5, onMap: 5 },
      { type: 'vessel', label: 'Vessel', total: 770, onMap: 0 },
    ],
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof TypeCountList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ATypeWithAPartOnTheMapSaysThePartTheWholeAndTheRest: Story = {
  play: async ({ canvas }) => {
    const row = canvas.getByText('Refinery').closest('li');
    await expect(row).toHaveTextContent('28 of 46 on the map');
    await expect(row).toHaveTextContent('18 have no known position');
  },
};

export const VesselsWithNoneOnTheMapSayWhy: Story = {
  play: async ({ canvas }) => {
    const row = canvas.getByText('Vessel').closest('li');
    await expect(row).toHaveTextContent('770, none on the map');
    await expect(row).toHaveTextContent('a vessel moves');
  },
};
