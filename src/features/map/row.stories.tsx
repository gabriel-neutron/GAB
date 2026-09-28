import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { project, type GeoEntity, type TypeFacet } from './projection';
import { IndexRows } from './row';

const projection = project(corpus, entityTypes);

function facetOf(type: string): TypeFacet {
  const facet = projection.facetByType.get(type);
  if (facet === undefined) throw new Error(`The fixture draws no entity of type ${type}.`);
  return facet;
}

function entitiesOf(type: string): readonly GeoEntity[] {
  return projection.entities.filter((entity) => entity.type === type);
}

// A row is keyed by identity and never by a position in a list, so a story that names an entity
// by its label must find that identity first.
function idOf(label: string): string {
  const held = projection.entities.find((entity) => entity.label === label);
  if (held === undefined) throw new Error(`The fixture draws no entity labelled ${label}.`);
  return held.id;
}

const VESSELS = entitiesOf('vessel');
const UNITS = entitiesOf('military_unit');

const meta = {
  component: IndexRows,
  args: { selectedId: null, onSelect: fn() },
  // The design measures the rail at 240px wide and the row at 24px high.
  render: (args) => (
    <div className="w-60">
      <IndexRows {...args} />
    </div>
  ),
} satisfies Meta<typeof IndexRows>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EachRowNamesItsEntityAndNothingElse: Story = {
  args: { facet: facetOf('vessel'), entities: VESSELS },
  play: async ({ canvasElement }) => {
    const rows = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-row]'));
    await expect(rows).toHaveLength(VESSELS.length);
    for (const [index, row] of rows.entries()) {
      await expect(row).toHaveTextContent(VESSELS[index]?.label ?? '');
    }
    await expect(canvasElement.querySelector('[data-column-key]')).toBeNull();
    await expect(canvasElement.querySelector('[data-cell]')).toBeNull();
  },
};

export const ARowSelectsItsEntity: Story = {
  args: {
    facet: facetOf('vessel'),
    entities: VESSELS,
    selectedId: VESSELS[0]?.id ?? null,
  },
  play: async ({ args, canvasElement }) => {
    const rows = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-row]'));
    const first = rows[0];
    const second = rows[1];
    if (first === undefined || second === undefined) {
      throw new Error('The fixture draws fewer than two vessels.');
    }
    await expect(first).toHaveAttribute('aria-current', 'true');
    await expect(second).not.toHaveAttribute('aria-current');

    await userEvent.click(second);
    await expect(args.onSelect).toHaveBeenCalledWith(VESSELS[1]?.id);
  },
};

// The parent was located and the child was not, so the child is drawn at the point of the parent.
// The canvas says THAT with a halo; this row draws no canvas, so these words are the only thing
// that can say it here, and they must name the parent and never the child.
export const ABorrowedPositionNamesTheParent: Story = {
  args: { facet: facetOf('military_unit'), entities: UNITS },
  play: async ({ canvasElement }) => {
    const said = (label: string): string | null => {
      const row = canvasElement.querySelector<HTMLElement>(`[data-id="${idOf(label)}"]`);
      if (row === null) throw new Error(`The index draws no row for ${label}.`);
      return row.querySelector<HTMLElement>('[data-position-from]')?.textContent ?? null;
    };

    await expect(said('3rd Reconnaissance Company')).toBe('position from 92nd Coastal Battery');
    // The parent stands at its own point, so it borrows from nobody and states nothing.
    await expect(said('92nd Coastal Battery')).toBeNull();
  },
};

// The graphic is a military symbol, and most readers read none. So the row carries the echelon
// and the domain in words beside it, and a unit that recorded no domain says nothing about one.
export const TheRowNamesTheEchelonAndTheDomainInWords: Story = {
  args: { facet: facetOf('military_unit'), entities: UNITS },
  play: async ({ canvasElement }) => {
    const said = (label: string): string | null => {
      const row = canvasElement.querySelector<HTMLElement>(`[data-id="${idOf(label)}"]`);
      if (row === null) throw new Error(`The index draws no row for ${label}.`);
      return row.querySelector<HTMLElement>('[data-symbol-words]')?.textContent ?? null;
    };

    await expect(said('92nd Coastal Battery')).toBe('Company/battery/troop, Ground');
    await expect(said('3rd Reconnaissance Company')).toBe('Battalion/squadron');
  },
};

// A vessel is not a unit, so no row of a vessel is given a frame or the words that go with one.
export const AVesselIsGivenNoUnitFrame: Story = {
  args: { facet: facetOf('vessel'), entities: VESSELS },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-unit-symbol]')).toBeNull();
    await expect(canvasElement.querySelector('[data-symbol-words]')).toBeNull();
  },
};

// An entity that carries a point and states no word must read as the cautious state. The words
// of a borrowed position are a claim, and an absent claim is never a measured one.
export const AnEntityThatStatesNoWordSaysNothingAboutItsPosition: Story = {
  args: { facet: facetOf('vessel'), entities: VESSELS },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-position-from]')).toBeNull();
  },
};

export const AnEmptyListSaysNoNameMatches: Story = {
  args: { facet: facetOf('vessel'), entities: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-no-match]')).not.toBeNull();
    await expect(canvasElement.querySelectorAll('[data-row]')).toHaveLength(0);
  },
};
