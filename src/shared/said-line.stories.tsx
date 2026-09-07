import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { calm, interrupt } from './said';
import { SaidLine } from './said-line';

const LABEL = 'The result of the act';

const meta = {
  component: SaidLine,
  args: { said: calm('The change is going to the record.'), label: LABEL },
} satisfies Meta<typeof SaidLine>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ACalmSentenceWaitsItsTurn: Story = {
  play: async ({ canvas }) => {
    const said = canvas.getByRole('status', { name: LABEL });
    await expect(said).toHaveTextContent('The change is going to the record.');
    await expect(canvas.queryByRole('alert')).toBeNull();
  },
};

// The one check of the rule. A doubt about a write that may have run whole is the thing the
// analyst acts on first, so it must reach a reader of the screen without a second look.
export const AnUrgentSentenceInterrupts: Story = {
  args: { said: interrupt('It is not known whether the change was written.') },
  play: async ({ canvas }) => {
    const said = canvas.getByRole('alert', { name: LABEL });
    await expect(said).toHaveTextContent('It is not known whether the change was written.');
    await expect(canvas.queryByRole('status')).toBeNull();
  },
};
