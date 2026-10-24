import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { HelpPage } from './help-page';

const meta = {
  component: HelpPage,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HelpPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DefinesTheWordsAndEachRelationType: Story = {
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { name: 'Help and glossary' })).toBeVisible();
    await expect(canvas.getByText('Pending proposal')).toBeVisible();
    await expect(canvas.getByText('Hostile')).toBeVisible();
    await expect(canvas.getByText(/holds shares or control of another party/u)).toBeVisible();
  },
};
