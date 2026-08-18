/**
 * One line of the index draws the name of an entity, and nothing else.
 *
 * **The two stories that stood here are gone with their subject.** They proved the one column of
 * values: `vessel` reading down as a straight column of IMO numbers, and `facility` showing blanks
 * under a named header. The operator ruled that column off the screen — #81 rows B5, B6 and B7 —
 * so a story that asserts it would prove a surface that no longer exists.
 *
 * **The measurement they made is not lost, because it is the reason for the ruling.** On this
 * sample `vessel` carries `imo` on 8 of 8, and `facility` carries `throughput_kt_month` on 2 of 11:
 * a column that is full for one type and blank for nine rows of another. #76 records it, and #12
 * owns a readable name for an attribute.
 *
 * The read arrives through `project()` over `@/shared/fixtures/corpus`, which is what the caller of
 * this component reads. Both change on the day `src/contract/` replaces the fixture — #46.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';

import { project, type GeoEntity, type TypeFacet } from './projection';
import { IndexRows } from './row';

const projection = project(corpus);

/** The projection derives each group. This story reads one, and it derives nothing. */
function facetOf(type: string): TypeFacet {
  const facet = projection.facetByType.get(type);
  if (facet === undefined) throw new Error(`The fixture draws no entity of type ${type}.`);
  return facet;
}

/** The drawn entities of one type, in the order the projection holds them. */
function entitiesOf(type: string): readonly GeoEntity[] {
  return projection.entities.filter((entity) => entity.type === type);
}

const VESSELS = entitiesOf('vessel');

const meta = {
  component: IndexRows,
  args: { selectedId: null, onSelect: fn() },
  // The rail is 240px wide in the design this row was chosen from, and the row is 24px high.
  // Both are part of the contract, so the story states the width it draws at.
  render: (args) => (
    <div className="w-60">
      <IndexRows {...args} />
    </div>
  ),
} satisfies Meta<typeof IndexRows>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * One row per drawn entity, and each row carries the name of its own entity.
 *
 * **No row carries a second value.** The group is asserted to draw no cell and no header at all:
 * a column that came back would fail here, and not only in a review.
 */
export const EachRowNamesItsEntityAndNothingElse: Story = {
  args: { facet: facetOf('vessel'), entities: VESSELS },
  play: async ({ canvasElement }) => {
    const rows = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-row]'));
    await expect(rows).toHaveLength(VESSELS.length);
    for (const [index, row] of rows.entries()) {
      await expect(row).toHaveTextContent(VESSELS[index]?.label ?? '');
    }
    // #81 B5 and B6: the header and the value cell left this component.
    await expect(canvasElement.querySelector('[data-column-key]')).toBeNull();
    await expect(canvasElement.querySelector('[data-cell]')).toBeNull();
  },
};

/**
 * A row reports the entity it names, and the caller moves the camera — §4.5.
 *
 * The group states the selected row with `aria-current`, so a reader who cannot see the paint
 * still hears which row is the selection.
 */
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
