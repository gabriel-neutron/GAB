import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { FIXTURE_RELEASE } from './fixture-release';
import { globeData } from './globe-data';
import { ReadingNotes } from './reading-notes';

const data = globeData(FIXTURE_RELEASE.chain);

const meta = {
  component: ReadingNotes,
  args: { data },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ReadingNotes>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OpensToTheRulesOfTheMapAndTheCountOfEachProductChain: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByText('How to read this map'));
    await expect(canvas.getByText(/Natural Earth/u)).toBeVisible();
    await expect(canvas.getByRole('list', { name: 'Product chains' })).toHaveTextContent(
      'Crude oil:',
    );
    await expect(canvas.getByRole('list', { name: 'Stages of the chain' })).toBeVisible();
    await expect(canvas.getByText(/50% rule/u)).toBeVisible();
  },
};
