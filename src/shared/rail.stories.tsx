import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { Rail, type RailRows, type RailTypeRow } from '@/shared/rail';

/**
 * The states of the two-step rail, which the map and the graph both draw.
 *
 * No surface document owns this file: the rail is shared, so its contract is its two call sites —
 * `src/features/map/rail.tsx` and `src/features/graph/graph-page.tsx` — and the rules of the
 * `component` skill. The behaviour it must hold is the "Works when" both documents state:
 * `docs/map-surface.md` §4.5 and `docs/graph-surface.md` §4.4. A type switches off and the count
 * says so. An entity is reached by name in two steps. The folded rail still says what is drawn.
 *
 * **The rows are stated here, and no read module is imported.** A shared file has no surface
 * document and no one read: each caller derives these rows from its own model — `railRows` on the
 * map, `deriveRailRows` on the graph. The shape is the contract, so the shape is what a story
 * states. The two derivations are checked where they live.
 *
 * **Each assertion reads the contract**: a role, an accessible name, `aria-pressed`,
 * `aria-expanded`, `aria-controls`, a `data-` attribute or the text. No story reads a class and
 * none reads a colour.
 *
 * ## What no story of this file can reach
 *
 * - **The list of entities.** The rail takes it as a slot, because a row is not the same component
 *   on the two surfaces. `src/features/map/row.stories.tsx` and
 *   `src/features/graph/row.stories.tsx` hold the two.
 * - **The camera.** A row of the index moves it, and the rail reports the act and moves nothing.
 */

const row = (over: Partial<RailTypeRow> & { readonly type: string }): RailTypeRow => ({
  initial: over.type.slice(0, 1).toUpperCase(),
  count: 12,
  on: true,
  open: false,
  stateWord: 'on',
  name: `${over.type}, 12 on the map`,
  colour: null,
  ...over,
});

const rows = (over: Partial<RailRows> = {}): RailRows => ({
  types: [row({ type: 'vessel' }), row({ type: 'port', count: 7 })],
  openTypes: [],
  everyTypeOff: false,
  open: true,
  ...over,
});

const onAct = fn();

const meta = {
  component: Rail,
  args: {
    rows: rows(),
    onAct,
    index: (type: string) => <p data-index={type}>The index of {type}</p>,
    footer: <p data-footer="">The footer of the surface</p>,
  },
  // The width is part of the contract of each caller — 240px open and a 44px strip closed on the
  // map — and the caller states it. The stories below state a width so that the two shapes are
  // drawn at the size an analyst meets.
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Rail>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * #91 and #94: an eye in place of the words `on` and `off`.
 *
 * **The eye is hidden from a reader, and the words are not.** One icon cannot say "hidden" on the
 * map and "dimmed" on the graph, and a struck-out eye claims the first on both surfaces. So the
 * glyph is the state for the eye alone, and the caller's own words reach a screen reader.
 */
export const TheStateIsAnEyeForTheEyeAndWordsForTheReader: Story = {
  args: {
    rows: rows({
      types: [
        row({ type: 'vessel' }),
        row({ type: 'port', count: 7, on: false, stateWord: 'off, dimmed' }),
      ],
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    // Two rows, two eyes, and neither is exposed.
    const eyes = canvasElement.querySelectorAll('svg[aria-hidden="true"].lucide-eye');
    const shut = canvasElement.querySelectorAll('svg[aria-hidden="true"].lucide-eye-off');
    await expect(eyes).toHaveLength(1);
    await expect(shut).toHaveLength(1);

    // The words the caller wrote are what a reader hears, and they are surface-specific.
    await expect(canvas.getByRole('button', { pressed: false })).toHaveTextContent('off, dimmed');
    await expect(canvas.getByRole('button', { pressed: true })).toHaveTextContent('on');
  },
};

/**
 * "A type switches off, and the count beside it says so." The count is honest and it does not
 * change where the surface dims, so the row states the consequence in words. A line through the
 * text said it to a reader who sees the strike, and to nobody else.
 */
export const ATypeSwitchesOffAndTheCountSaysSo: Story = {
  args: {
    rows: rows({
      types: [
        row({ type: 'vessel' }),
        row({ type: 'port', count: 7, on: false, stateWord: 'off, dimmed' }),
      ],
    }),
  },
  play: async ({ canvas, args }) => {
    const off = canvas.getByRole('button', { pressed: false });
    await expect(off).toHaveTextContent('port');
    await expect(off).toHaveTextContent('7');
    await expect(off).toHaveTextContent('off, dimmed');

    await userEvent.click(off);
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'switch-type', type: 'port', on: true });
  },
};

/**
 * The two acts on one row are not the same act. The chevron unfolds the index; the rest of the row
 * switches the type. A control that conflated them switched a type off whenever the analyst wanted
 * to look inside it.
 */
export const TheFoldAndTheSwitchAreTwoActs: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open the vessel list' }));
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'open-type', type: 'vessel' });

    const [onRow] = canvas.getAllByRole('button', { pressed: true });
    if (onRow === undefined) throw new Error('The rail draws no type row that is on');
    await userEvent.click(onRow);
    await expect(args.onAct).toHaveBeenCalledWith({
      kind: 'switch-type',
      type: 'vessel',
      on: false,
    });
  },
};

/**
 * One type is unfolded at a time, and the field belongs to it. The fold control names the region
 * it opens **only while that region is in the tree**: a closed row that named it sent a reader to
 * an element that is not there.
 */
export const AnUnfoldedTypeCarriesItsOwnIndex: Story = {
  args: {
    rows: rows({
      types: [row({ type: 'vessel', open: true }), row({ type: 'port', count: 7 })],
      openTypes: ['vessel'],
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    const open = canvas.getByRole('button', { name: 'Close the vessel list' });
    await expect(open).toHaveAttribute('aria-expanded', 'true');
    await expect(open).toHaveAttribute('aria-controls', 'rail-index-vessel');

    const closed = canvas.getByRole('button', { name: 'Open the port list' });
    await expect(closed).toHaveAttribute('aria-expanded', 'false');
    await expect(closed).not.toHaveAttribute('aria-controls');

    // The slot belongs to the open type, and to no other row.
    await expect(canvasElement.querySelectorAll('[data-index]')).toHaveLength(1);
    // #82 C6: no search field stands in this rail any more.
    await expect(canvasElement.querySelector('input')).toBeNull();
  },
};

/**
 * #82 C5: **more than one type may stand unfolded**. Opening a second one closed the first, and
 * an analyst could not read two lists beside each other.
 *
 * Each open row asks the caller for its own list, so the two indexes are two elements and never
 * one that the rail moves about.
 */
export const MoreThanOneTypeStandsUnfolded: Story = {
  args: {
    rows: rows({
      types: [row({ type: 'vessel', open: true }), row({ type: 'port', count: 7, open: true })],
      openTypes: ['vessel', 'port'],
    }),
  },
  play: async ({ canvas, canvasElement, args }) => {
    const drawn = canvasElement.querySelectorAll('[data-index]');
    await expect(drawn).toHaveLength(2);
    await expect(canvasElement.querySelector('[data-index="vessel"]')).not.toBeNull();
    await expect(canvasElement.querySelector('[data-index="port"]')).not.toBeNull();

    // Folding one names the type and the state it asked for, and it says nothing about the other.
    await userEvent.click(canvas.getByRole('button', { name: 'Close the port list' }));
    await expect(args.onAct).toHaveBeenCalledWith({
      kind: 'open-type',
      type: 'port',
      open: false,
    });
  },
};

/**
 * §5.2: a control that can exclude everything carries the way back. A prototype reached an
 * all-grey screen, and the filter is stored, so that screen survived a reload.
 */
export const AControlThatExcludesEverythingCarriesTheWayBack: Story = {
  args: {
    rows: rows({
      types: [
        row({ type: 'vessel', on: false, stateWord: 'off' }),
        row({ type: 'port', count: 7, on: false, stateWord: 'off' }),
      ],
      everyTypeOff: true,
    }),
  },
  play: async ({ canvas, args }) => {
    await expect(canvas.getByText(/Every type is off/)).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Switch every type on' }));
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'show-every-type' });
  },
};

/**
 * The folded rail still says what is drawn. §4.5 keeps the switches and the counts in the strip
 * and loses **only the list**. A sentence does not fit in 44px, so the number stays on the screen
 * and the caller's name says the words to the reader.
 *
 * **The footer is drawn in both states.** A footer that vanished with the fold would drop the
 * count of what cannot be drawn, which §3.3 puts on the screen in words.
 */
export const TheFoldedRailStillSaysWhatIsDrawn: Story = {
  args: {
    rows: rows({
      types: [
        row({ type: 'vessel' }),
        row({ type: 'port', count: 7, on: false, name: 'port, 7 off the map' }),
      ],
      open: false,
    }),
  },
  play: async ({ canvas, canvasElement }) => {
    // The switch and its count survive the fold, and the name carries the state.
    const off = canvas.getByRole('button', { name: 'port, 7 off the map' });
    await expect(off).toHaveAttribute('aria-pressed', 'false');
    await expect(off).toHaveTextContent('7');

    await expect(canvas.getByRole('button', { name: 'Open the rail' })).toBeVisible();
    await expect(canvasElement.querySelector('[data-footer]')).not.toBeNull();
    // Only the list is lost.
    await expect(canvasElement.querySelector('[data-index]')).toBeNull();
  },
};

/** The fold of the rail is an act like any other, and the caller owns the workspace field. */
export const TheRailReportsItsOwnFold: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Close the rail' }));
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'open-rail', open: false });
  },
};

/**
 * A type that is switched off has no index: the surface draws none of it, so a list of it would
 * name entities that no canvas shows.
 */
export const ATypeThatIsOffCarriesNoIndex: Story = {
  args: {
    rows: rows({
      types: [row({ type: 'vessel', open: true, on: false, stateWord: 'off' })],
      openTypes: ['vessel'],
    }),
  },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-index]')).toBeNull();
    await expect(canvasElement.querySelector('#rail-index-vessel')).toBeNull();
  },
};
