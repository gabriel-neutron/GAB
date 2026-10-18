import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { ChainSteps } from './chain-steps';
import { FIXTURE_RELEASE } from './fixture-release';
import { globeData } from './globe-data';
import { createGlobeStore, type GlobeStore } from './globe-store';

const { steps } = globeData(FIXTURE_RELEASE.chain);

const fresh = (still = false): GlobeStore =>
  createGlobeStore({ steps: steps.map((one) => one.key), still, entity: null });

const meta = {
  component: ChainSteps,
  args: { steps, store: fresh() },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="dark w-160 bg-background text-foreground">
      <ChainSteps {...args} />
    </div>
  ),
} satisfies Meta<typeof ChainSteps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheSixStepsShowTheirCountsAndAStepSaysItsSentence: Story = {
  play: async ({ args, canvas }) => {
    const strip = canvas.getByRole('list', { name: 'Steps of the chain' });
    for (const one of steps)
      await expect(strip).toHaveTextContent(`${one.label}: ${String(one.count)}`);
    const refinery = canvas.getByRole('button', { name: /^Refinery/u });
    await expect(refinery).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(refinery);
    await expect(args.store.get().step).toBe('refinery');
    await expect(canvas.getByRole('status')).toHaveTextContent(/has a position/u);
    await expect(refinery).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(refinery);
    await expect(args.store.get().step).toBeNull();
    await expect(canvas.getByRole('status')).toBeEmptyDOMElement();
  },
};

export const PlayGoesToTheFirstStepAndPauseStopsIt: Story = {
  args: { store: fresh() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play the chain' }));
    await expect(args.store.get()).toMatchObject({ playing: true, step: 'extraction' });
    await userEvent.click(canvas.getByRole('button', { name: 'Pause' }));
    await expect(args.store.get().playing).toBe(false);
    await expect(canvas.getByRole('button', { name: 'Play the chain' })).toBeVisible();
  },
};

export const WithNoMotionAPressGoesToTheNextStepAndStopMotionIsOff: Story = {
  args: { store: fresh(true) },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Stop motion' })).toBeDisabled();
    await userEvent.click(canvas.getByRole('button', { name: 'Next step' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Next step' }));
    await expect(args.store.get()).toMatchObject({ playing: false, step: 'pipeline' });
  },
};

export const StopMotionStopsThePlayForTheRestOfTheVisit: Story = {
  args: { store: fresh() },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Play the chain' }));
    await userEvent.click(canvas.getByRole('button', { name: 'Stop motion' }));
    await expect(args.store.get()).toMatchObject({ playing: false, moving: false });
    await expect(canvas.getByRole('button', { name: 'Next step' })).toBeVisible();
  },
};

export const DrawsNothingWhenTheBrowserCannotDrawTheGlobe: Story = {
  args: {
    store: (() => {
      const store = fresh();
      store.setUnavailable();
      return store;
    })(),
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('list', { name: 'Steps of the chain' })).toBeNull();
  },
};
