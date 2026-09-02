import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import { entityTypes } from '@/shared/fixtures/entity-types';

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

const VESSELS = entitiesOf('vessel');

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
