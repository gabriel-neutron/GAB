import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import { vocabulary } from '@/shared/fixtures/vocabulary';

import { readDossier, type Dossier } from './dossier';
import { SeparationColumns, SeparationRuled, SeparationTabbed } from './segmentation-proto';

/** MV Northern Ledger, the entity the page stories already read. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const read = (): Dossier => {
  const held = readDossier(corpus, VESSEL, vocabulary);
  if (held === null) throw new Error('The committed corpus holds no MV Northern Ledger');
  return held;
};

const DOSSIER = read();

// The row states a height, exactly as the route does. Without a stated height on the row,
// `overflow-y-auto` is not a scroll at all.
const WIDE = 'flex h-[600px]';

/** The width of the panel beside a canvas, which is the second width every option must hold. */
const NARROW = 'flex h-[600px] w-96 border border-border';

const meta = {
  title: 'Prototype/Detail segmentation',
  parameters: { layout: 'fullscreen' },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const RuledBandsAtFullWidth: Story = {
  render: () => (
    <div className={WIDE}>
      <SeparationRuled dossier={DOSSIER} trail="beside" />
    </div>
  ),
};

export const RuledBandsAtTheRailWidth: Story = {
  render: () => (
    <div className={NARROW}>
      <SeparationRuled dossier={DOSSIER} trail="below" />
    </div>
  ),
};

export const TabbedTailAtFullWidth: Story = {
  render: () => (
    <div className={WIDE}>
      <SeparationTabbed dossier={DOSSIER} trail="beside" />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('tab', { name: /Relations/ })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await userEvent.click(canvas.getByRole('tab', { name: /Sources/ }));
    await expect(within(canvas.getByRole('tabpanel')).getByRole('complementary')).toBeVisible();
  },
};

export const TabbedTailAtTheRailWidth: Story = {
  render: () => (
    <div className={NARROW}>
      <SeparationTabbed dossier={DOSSIER} trail="below" />
    </div>
  ),
};

export const ColumnsAtFullWidth: Story = {
  render: () => (
    <div className={WIDE}>
      <SeparationColumns dossier={DOSSIER} trail="beside" />
    </div>
  ),
};

export const ColumnsAtTheRailWidth: Story = {
  render: () => (
    <div className={NARROW}>
      <SeparationColumns dossier={DOSSIER} trail="below" />
    </div>
  ),
};
