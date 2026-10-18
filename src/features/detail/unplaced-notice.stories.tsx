import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { UnplacedNotice } from './unplaced-notice';

const meta = {
  component: UnplacedNotice,
  args: { words: 'A. Vasilakis has no position, so the map does not show it.' },
} satisfies Meta<typeof UnplacedNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheMapSaysWhyItDrawsNoSelection: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('complementary', { name: 'Detail' })).toHaveTextContent(
      'A. Vasilakis has no position, so the map does not show it.',
    );
  },
};
