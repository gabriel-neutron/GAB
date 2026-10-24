import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { FIXTURE_RELEASE } from './fixture-release';
import { globeData } from './globe-data';
import { createGlobeStore, type GlobeStore } from './globe-store';
import { stageRows } from './legend-rows';
import { StageStrip } from './stage-strip';

const data = globeData(FIXTURE_RELEASE.chain);
const rows = stageRows([
  ...data.entities.features.map((one) => one.properties['stageKey']),
  // An exit point is not an entity, and the map draws it as a ring.
  ...data.exits.features.map(() => 'exit'),
]);

const fresh = (): GlobeStore =>
  createGlobeStore({ steps: data.steps.map((one) => one.key), still: true, entity: null });

const meta = {
  component: StageStrip,
  args: { rows, store: fresh() },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="w-240 bg-background text-foreground">
      <StageStrip {...args} />
    </div>
  ),
} satisfies Meta<typeof StageStrip>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The six stages stand in chain order, and no stage stands apart, after them. */
export const TheStagesStandInChainOrderWithTheirCounts: Story = {
  play: async ({ canvas }) => {
    const chain = canvas.getAllByRole('listitem').map((one) => one.textContent);
    await expect(chain.filter(Boolean).map((one) => one.replace(/: \d+$/u, ''))).toEqual([
      'Fields',
      'Upstream transport',
      'Refining and liquefaction',
      'Export',
      'Exit from Russian control',
      'Declared destination',
    ]);
    await expect(canvas.getByRole('button', { name: /^No stage\W+\d+$/u })).toBeVisible();
  },
};

/** A press puts one stage forward, and a second press shows every stage again. */
export const APressPutsOneStageForward: Story = {
  args: { store: fresh() },
  play: async ({ args, canvas }) => {
    const fields = canvas.getByRole('button', { name: /^Fields\W/u });
    await userEvent.click(fields);
    await expect(fields).toHaveAttribute('aria-pressed', 'true');
    await expect(args.store.get().stage).toBe('field');
    await userEvent.click(fields);
    await expect(args.store.get().stage).toBeNull();
  },
};

/** The strip reads in the dark theme too. */
export const TheStripReadsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark w-240 bg-background text-foreground">
      <StageStrip {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('group', { name: 'Stages of the chain' })).toBeVisible();
  },
};
