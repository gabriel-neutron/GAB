import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { natoSymbol, type NatoSymbol } from './nato-symbol';
import { project } from './projection';
import { UnitSymbol } from './unit-symbol';

const projection = project(corpus, entityTypes);

// The same derivation the index row reads, over the same record. A symbol built by hand here
// would prove a drawing that no corpus can produce.
function symbolOf(label: string): NatoSymbol | null {
  const held = projection.entities.find((entity) => entity.label === label);
  if (held === undefined) throw new Error(`The fixture draws no entity labelled ${label}.`);
  return held.symbol;
}

const WITH_DOMAIN = symbolOf('92nd Coastal Battery');
const WITHOUT_DOMAIN = symbolOf('3rd Reconnaissance Company');

const meta = {
  component: UnitSymbol,
  args: { symbol: WITH_DOMAIN },
} satisfies Meta<typeof UnitSymbol>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A unit that carries an echelon draws that mark above the frame. */
export const AnEchelonDrawsItsMarkAboveTheFrame: Story = {
  args: { symbol: WITHOUT_DOMAIN },
  play: async ({ canvas }) => {
    const drawn = canvas.getByRole('img');
    await expect(drawn).toHaveAttribute('data-echelon-mark', 'drawn');
    await expect(drawn).toHaveAccessibleName('Hostile unit, Battalion/squadron');
  },
};

/** Two thirds of the units record no domain. The symbol omits what the source never recorded,
 * and the frame must never read as a ground unit. */
export const AnAbsentDomainDrawsNoDomainMark: Story = {
  args: { symbol: WITHOUT_DOMAIN },
  play: async ({ canvas }) => {
    const drawn = canvas.getByRole('img');
    await expect(drawn).toHaveAttribute('data-domain-mark', 'none');
    await expect(drawn).not.toHaveAccessibleName(/Ground/);
  },
};

/** A recorded domain does draw its mark, so the absence above is a state and not the only state. */
export const ARecordedDomainDrawsItsMark: Story = {
  args: { symbol: WITH_DOMAIN },
  play: async ({ canvas }) => {
    const drawn = canvas.getByRole('img');
    await expect(drawn).toHaveAttribute('data-domain-mark', 'drawn');
    await expect(drawn).toHaveAccessibleName('Hostile unit, Company/battery/troop, Ground');
  },
};

// A word outside the eleven the corpus holds. The frame still draws, the mark does not, and the
// reader still reads the word, because the words repeat the attribute and never the mark.
export const AnUnlistedEchelonDrawsNoMarkAndThrowsNothing: Story = {
  args: {
    symbol: natoSymbol('military_unit', {
      affiliation: { v: 'Hostile', src: ['doc_5e7730'] },
      echelon: { v: 'Fire team', src: ['doc_5e7730'] },
    }),
  },
  play: async ({ canvas }) => {
    const drawn = canvas.getByRole('img');
    await expect(drawn).toHaveAttribute('data-echelon-mark', 'none');
    await expect(drawn).toHaveAccessibleName('Hostile unit, Fire team');
  },
};

/** A reader who reads no military symbol must be able to name what it says. */
export const TheReaderCanNameTheEchelonAndTheDomain: Story = {
  args: { symbol: WITH_DOMAIN },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('img')).toHaveAccessibleName(/Company\/battery\/troop, Ground/);
  },
};

/** A facility and an organisation are not units, so neither is given a unit frame. */
export const AFacilityIsGivenNoUnitFrame: Story = {
  args: { symbol: natoSymbol('facility', { affiliation: { v: 'Hostile', src: ['doc_8f2a41'] } }) },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-unit-symbol]')).toBeNull();
  },
};
