/**
 * The check of step 7 of `docs/map-surface.md` §8: `vessel` reads down as one column, and
 * `facility` shows blanks under a named header.
 *
 * The read arrives through `project()` over `@/shared/fixtures/corpus`, which is what the caller
 * of this component reads. Both change on the day `src/contract/` replaces the fixture.
 *
 * §3.2 measured the two cases on this sample: `vessel` carries `imo` on 8 of 8, and `facility`
 * carries `throughput_kt_month` on 2 of 11. Each story asserts the text of each cell, per row,
 * against the same projection the component receives. A group that pairs the wrong entity with
 * the wrong value then fails.
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';

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

function entitiesOf(type: string): readonly GeoEntity[] {
  const entities = projection.entitiesByType.get(type);
  if (entities === undefined) throw new Error(`The fixture draws no entity of type ${type}.`);
  return entities;
}

/** One element of the group. An absent element is a fault of the component, and it stops here. */
function elementIn(root: HTMLElement, selector: string): HTMLElement {
  const found = root.querySelector<HTMLElement>(selector);
  if (found === null) throw new Error(`The group draws no element for ${selector}.`);
  return found;
}

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
 * Criterion 1 and the first clause of the *Check*: "Every row of `vessel` shows an IMO in one
 * straight column."
 *
 * Three assertions, because the clause holds three facts. The header names the key in full. Each
 * row shows the value of its own entity. Each cell ends on one right edge, which is what a column
 * that reads down means. The story waits for `document.fonts.ready` first: the theme declares two
 * families, and a measurement before the fonts arrive gives a different width.
 */
export const VesselShowsAnImoInOneStraightColumn: Story = {
  args: { facet: facetOf('vessel'), entities: entitiesOf('vessel') },
  play: async ({ canvas, canvasElement }) => {
    await document.fonts.ready;

    // The header says `imo`, and the box of the header is not smaller than the text in it. A
    // header that clips names no column, and the text alone does not show the clip.
    const header = elementIn(canvasElement, '[data-column-key]');
    await expect(header).toHaveTextContent('imo');
    await expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);

    const entities = entitiesOf('vessel');
    const edges = new Set<number>();
    for (const entity of entities) {
      const cell = elementIn(canvasElement, `[data-id="${entity.id}"] [data-cell]`);
      // The cell of this row holds the value of this entity, and of no other row.
      await expect(cell.textContent).toBe(entity.keyValue);
      await expect(entity.keyValue).toMatch(/^\d{7}$/);
      edges.add(Math.round(cell.getBoundingClientRect().right));
    }

    await expect(edges.size).toBe(1);
    await expect(canvas.getAllByRole('button')).toHaveLength(entities.length);
  },
};

/**
 * Criterion 2 and the second clause of the *Check*: "Every row of `facility` that carries no
 * throughput shows nothing there, under a header that says `throughput_kt_month`."
 *
 * The header is asserted by its exact text, in the raw machine key: #12 owns the attribute
 * vocabulary, and a humanised key would answer it here. Each cell is asserted against the value
 * the projection gives that entity, so a blank proves an absence and a value proves a value.
 *
 * The labels of `facility` are the longest in the fixture, and the group draws at the 240px of
 * the rail. A name that does not truncate therefore pushes the column off the line, and the
 * width assertions below catch it.
 */
export const FacilityShowsBlanksUnderANamedHeader: Story = {
  args: { facet: facetOf('facility'), entities: entitiesOf('facility') },
  play: async ({ canvas, canvasElement }) => {
    await document.fonts.ready;

    const header = elementIn(canvasElement, '[data-column-key]');
    await expect(header).toHaveTextContent('throughput_kt_month');
    await expect(header.scrollWidth).toBeLessThanOrEqual(header.clientWidth);

    const entities = entitiesOf('facility');
    const edges = new Set<number>();
    let blank = 0;
    for (const entity of entities) {
      const row = elementIn(canvasElement, `[data-id="${entity.id}"]`);
      const cell = elementIn(canvasElement, `[data-id="${entity.id}"] [data-cell]`);
      await expect(cell.textContent).toBe(entity.keyValue);
      // The long name stays inside the row, and it does not move the column.
      await expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth);
      edges.add(Math.round(cell.getBoundingClientRect().right));
      if (entity.keyValue === '') blank += 1;
    }

    // §3.2 measured `throughput_kt_month` on 2 of 11 facilities, so the group holds a value and a
    // blank. The story states a range, because the fixture can grow again.
    await expect(blank).toBeGreaterThan(0);
    await expect(blank).toBeLessThan(entities.length);
    await expect(edges.size).toBe(1);

    // A blank row is still a control with a readable name, so the absence reads as an absence and
    // not as a fault.
    await expect(canvas.getAllByRole('button')).toHaveLength(entities.length);
  },
};
