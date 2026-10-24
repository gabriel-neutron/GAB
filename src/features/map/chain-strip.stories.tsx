import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { chainView } from './chain-view';
import { ChainStrip, stepCounts } from './chain-strip';
import { project } from './projection';

const { steps } = chainView(corpus, project(corpus, entityTypes));

const meta = {
  component: ChainStrip,
  args: { steps, state: { chain: false, globe: false, step: null }, onAct: fn() },
} satisfies Meta<typeof ChainStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheModeAndTheGlobeAreOffAndTheStepsAreHidden: Story = {
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Chain' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(canvas.getByRole('button', { name: 'Globe' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(canvas.queryByRole('list', { name: 'Steps of the chain' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Chain' }));
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'switch-chain', on: true });
    await userEvent.click(canvas.getByRole('button', { name: 'Globe' }));
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'switch-globe', on: true });
  },
};

export const TheChainModeGivesTheSixStepsWithTheirCounts: Story = {
  args: { state: { chain: true, globe: true, step: null } },
  play: async ({ args, canvas }) => {
    const strip = canvas.getByRole('list', { name: 'Steps of the chain' });
    for (const one of steps)
      await expect(strip).toHaveTextContent(`${one.label}: ${stepCounts(one)}`);
    await userEvent.click(canvas.getByRole('button', { name: /^Refinery/u }));
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'show-step', key: 'refinery' });
  },
};

export const AStepInViewSaysItsSentenceAndASecondPressClearsIt: Story = {
  args: { state: { chain: true, globe: false, step: 'exit' } },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent(
      /exit points? from Russian control/u,
    );
    const exit = canvas.getByRole('button', { name: /^Exit/u });
    await expect(exit).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(exit);
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'show-step', key: null });
  },
};
