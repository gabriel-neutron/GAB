import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RefObject } from 'react';
import { expect, fireEvent, userEvent, waitFor } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import type { MapHandle } from './adapter';
import type { Ground } from './workspace';
import { GroundControl } from './ground-control';
import { entitiesOfType, project, type GeoLink } from './projection';
import { Rail } from './rail';

// No story mounts a live canvas: `MapHandle` is a type, so the double below is a plain object.
// The rail is 240px open (`w-60`) and a 44px strip closed (`w-11`).
const projection = project(corpus, entityTypes);

interface TestMap {
  /** The rail takes a ref, because `map-page.tsx` keeps the handle in a `useRef`. */
  readonly map: RefObject<MapHandle | null>;
  readonly flown: string[];
  readonly switched: { type: string; visible: boolean }[];
  readonly linksSwitched: boolean[];
  readonly grounds: Ground[];
}

/** The double holds the types that are switched off, which is the polarity the map keeps. */
function testMap(
  hidden: readonly string[],
  selected: string | null,
  chosen: GeoLink | null = null,
): TestMap {
  const off = new Set<string>(hidden);
  const listeners = new Set<(id: string | null) => void>();
  const flown: string[] = [];
  const switched: { type: string; visible: boolean }[] = [];
  const linksSwitched: boolean[] = [];
  const grounds: Ground[] = [];
  let current = selected;
  let currentGround: Ground = 'plan';
  let linksHidden = false;
  let chosenLink = chosen;

  const chooseListeners = new Set<(link: GeoLink | null) => void>();

  const dropChoice = (): void => {
    if (chosenLink === null) return;
    chosenLink = null;
    for (const listener of chooseListeners) listener(null);
  };

  const announce = (id: string | null): void => {
    if (id === current) return;
    current = id;
    // A new selection ends the choice of a relation, as the adapter does.
    dropChoice();
    for (const listener of listeners) listener(id);
  };

  const handle: MapHandle = {
    get selected() {
      return current;
    },
    select: (id) => {
      const entity = id === null ? undefined : projection.byId.get(id);
      announce(entity === undefined || off.has(entity.type) ? null : entity.id);
    },
    onSelect: (listener) => {
      listeners.add(listener);
      listener(current);
      return () => {
        listeners.delete(listener);
      };
    },
    flyTo: (id) => {
      // The adapter refuses a flight to an entity of a type that is switched off.
      const entity = projection.byId.get(id);
      if (entity === undefined || off.has(entity.type)) return;
      flown.push(id);
    },
    setTypeVisible: (type, visible) => {
      switched.push({ type, visible });
      if (visible) off.delete(type);
      else off.add(type);
      if (visible) return;
      const entity = current === null ? undefined : projection.byId.get(current);
      if (entity?.type === type) announce(null);
    },
    isTypeVisible: (type) => !off.has(type),
    setLinksVisible: (visible) => {
      linksSwitched.push(visible);
      linksHidden = !visible;
      if (!visible) dropChoice();
    },
    get linksVisible() {
      return !linksHidden;
    },
    get chosenLink() {
      return chosenLink;
    },
    onChooseLink: (listener) => {
      chooseListeners.add(listener);
      listener(chosenLink);
      return () => {
        chooseListeners.delete(listener);
      };
    },
    setGround: (next) => {
      currentGround = next;
      grounds.push(next);
    },
    get ground() {
      return currentGround;
    },
    destroy: () => {
      // The double owns nothing, so it releases nothing.
    },
  };

  return { map: { current: handle }, flown, switched, linksSwitched, grounds };
}

const facetOf = (type: string): { readonly type: string; readonly count: number } => {
  const facet = projection.types.find((candidate) => candidate.type === type);
  if (facet === undefined) throw new Error(`The fixture draws no entity of type ${type}.`);
  return facet;
};

const firstOf = <T,>(list: readonly T[], what: string): T => {
  const held = list[0];
  if (held === undefined) throw new Error(`The fixture holds no ${what}.`);
  return held;
};

const rowsIn = (root: HTMLElement): readonly HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-row]'));

const VESSEL = facetOf('vessel');
const VESSELS = entitiesOfType(projection, 'vessel');
const UNITS = entitiesOfType(projection, 'military_unit');

const onScreen = (row: HTMLElement, rail: HTMLElement): boolean => {
  const held = row.getBoundingClientRect();
  const box = rail.getBoundingClientRect();
  return held.top >= box.top && held.bottom <= box.bottom;
};

const switchOnly = testMap([], null);
const reachOnly = testMap([], null);
/** One double per story, so that one story never reads what another one wrote. */
const groundOnly = testMap([], null);
const polarityOnly = testMap(['vessel'], null);
const restoredOnly = testMap([], firstOf(VESSELS, 'vessel').id);
const revealOnly = testMap([], UNITS[1]?.id ?? null);
const foldedOnly = testMap([], firstOf(UNITS, 'military unit').id);
const clickedOnly = testMap([], null);
const linksOnly = testMap([], null);

const meta = {
  component: Rail,
  args: {
    projection,
    map: switchOnly.map,
    open: true,
    onOpenChange: () => {
      // The workspace write belongs to the caller, and no story asserts on it.
    },
  },
  // The rail takes its height from the row it sits in, beside the canvas. The story states one,
  // so that the index scrolls as it does on the surface.
  render: (args) => (
    <div className="flex h-96">
      <Rail {...args} />
    </div>
  ),
} satisfies Meta<typeof Rail>;

export default meta;

type Story = StoryObj<typeof meta>;

/** No story asserts the credit: MapLibre draws it over a live canvas, which stories never mount. */
export const TheGroundSwitchesThroughTheOneWriter: Story = {
  args: { map: groundOnly.map },
  // `map-page.tsx` places this control beside the rail, over the canvas, and not inside the rail.
  // This story mounts the same pair, so the click below reaches a real control.
  render: (args) => (
    <div className="relative flex h-96">
      <Rail {...args} />
      <GroundControl map={args.map} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    // The name says the ground in force and the one a click brings, because a glyph alone says
    // neither to a reader who cannot see it.
    const control = canvas.getByRole('button', { name: 'Ground: plan. Change to imagery.' });
    await expect(canvasElement.querySelector('[data-ground="plan"]')).not.toBeNull();

    await userEvent.click(control);

    await expect(groundOnly.grounds).toStrictEqual(['imagery']);
    await expect(
      canvas.getByRole('button', { name: 'Ground: imagery. Change to plan.' }),
    ).toBeVisible();
    await expect(canvasElement.querySelector('[data-ground="imagery"]')).not.toBeNull();
  },
};

// The store holds the choice, and the adapter is what writes it. A double holds nothing across a
// reload, so no story can reach that clause.
export const TheRelationLinesSwitchOffFromTheRail: Story = {
  args: { map: linksOnly.map },
  play: async ({ canvas }) => {
    const control = canvas.getByRole('button', { name: 'relation lines, on the map' });

    await userEvent.click(control);

    await expect(linksOnly.linksSwitched).toStrictEqual([false]);
    await expect(
      canvas.getByRole('button', { name: 'relation lines, off the map', pressed: false }),
    ).toBeVisible();
  },
};

/** The assertion reads the accessible name and `aria-pressed`, never a class or a colour. */
export const ATypeSwitchesOffAndTheCountSaysSo: Story = {
  args: { map: switchOnly.map },
  play: async ({ canvas }) => {
    await document.fonts.ready;

    // The width of the open rail is part of the contract: 240px.
    const rail = canvas.getByRole('complementary', { name: 'Layers' });
    await expect(Math.round(rail.getBoundingClientRect().width)).toBe(240);

    const vessel = canvas.getByRole('button', { name: /^vessel/, pressed: true });
    await userEvent.click(vessel);

    await expect(canvas.getByRole('button', { name: /^vessel/, pressed: false })).toBeVisible();

    await expect(canvas.getByRole('button', { name: /^vessel/ })).toHaveTextContent(
      String(VESSEL.count),
    );
  },
};

export const AnEntityIsReachedFromTheOpenList: Story = {
  args: { map: reachOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const target = firstOf(VESSELS, 'vessel');

    await userEvent.click(canvas.getByRole('button', { name: 'Open the vessel list' }));
    const drawn = rowsIn(canvasElement);
    await expect(drawn).toHaveLength(VESSELS.length);
    await expect(canvasElement.querySelector('input')).toBeNull();

    const row = firstOf(drawn, 'row of the index');
    await userEvent.click(row);

    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(reachOnly.flown).toContain(target.id);
  },
};

/** The map holds the types that are switched off, so a new type is never hidden. */
export const TheSwitchGoesThroughTheOneWriter: Story = {
  args: { map: polarityOnly.map },
  play: async ({ canvas }) => {
    // `vessel` is the one type the map holds as switched off. Every other type is on, and none of
    // them is named anywhere.
    await expect(canvas.getByRole('button', { name: /^vessel/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    for (const facet of projection.types) {
      if (facet.type === 'vessel') continue;
      const entry = canvas.getByRole('button', { name: new RegExp(`^${facet.type}`) });
      await expect(entry).toHaveAttribute('aria-pressed', 'true');
    }

    await userEvent.click(canvas.getByRole('button', { name: /^facility/ }));
    await expect(polarityOnly.switched).toEqual([{ type: 'facility', visible: false }]);
  },
};

/** A component that subscribes after the map is built has already missed the restore. */
export const ARestoredSelectionOpensItsGroup: Story = {
  args: { map: restoredOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const restored = firstOf(VESSELS, 'vessel');

    // The group is already open, so the fold control names the act that closes it.
    await expect(canvas.getByRole('button', { name: 'Close the vessel list' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    const row = firstOf(rowsIn(canvasElement), 'row of the index');
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toHaveTextContent(restored.label);
  },
};

// The fixture draws five types and two military units, so a rail of 80px puts every row of the
// index below the fold: the header takes 24px, and the five type rows take 120px more.
const SHORT: Story['render'] = (args) => (
  <div className="flex h-20">
    <Rail {...args} />
  </div>
);

export const AMapSelectionShowsItsRowOnScreen: Story = {
  args: { map: revealOnly.map },
  render: SHORT,
  play: async ({ canvas, canvasElement }) => {
    const marked = UNITS[1];
    if (marked === undefined) throw new Error('The fixture draws fewer than two military units.');

    await expect(
      canvas.getByRole('button', { name: 'Close the military_unit list' }),
    ).toHaveAttribute('aria-expanded', 'true');

    const row = canvasElement.querySelector<HTMLElement>(`[data-id="${marked.id}"]`);
    if (row === null) throw new Error('The index draws no row for the selected unit.');
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(onScreen(row, canvas.getByRole('complementary', { name: 'Layers' }))).toBe(true);
  },
};

export const AFoldedGroupOpensForAMapSelection: Story = {
  args: { map: foldedOnly.map },
  render: SHORT,
  play: async ({ canvas, canvasElement }) => {
    const next = UNITS[1];
    if (next === undefined) throw new Error('The fixture draws fewer than two military units.');

    await userEvent.click(canvas.getByRole('button', { name: 'Close the military_unit list' }));
    await expect(rowsIn(canvasElement)).toHaveLength(0);

    foldedOnly.map.current?.select(next.id);

    await waitFor(async () => {
      const row = canvasElement.querySelector<HTMLElement>(`[data-id="${next.id}"]`);
      if (row === null) throw new Error('The index draws no row for the selected unit.');
      await expect(row).toHaveAttribute('aria-current', 'true');
      await expect(onScreen(row, canvas.getByRole('complementary', { name: 'Layers' }))).toBe(true);
    });
  },
};

export const AClickInTheRailDoesNotMoveTheList: Story = {
  args: { map: clickedOnly.map },
  // 192px shows the header, the five type rows and two rows of the open list, and the list of
  // nine vessels runs past the fold, so the list can move and the analyst can click a row.
  render: (args) => (
    <div className="flex h-48">
      <Rail {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open the vessel list' }));

    const box = canvas.getByRole('complementary', { name: 'Layers' });
    const row = rowsIn(canvasElement).find((held) => onScreen(held, box));
    if (row === undefined) throw new Error('The open list draws no row on the screen.');
    const scroller = row.closest('[data-facet]')?.parentElement ?? null;
    if (scroller === null) throw new Error('The index sits in no scroller.');
    const held = scroller.scrollTop;

    // A click of the user event driver puts the row on the screen first, and the focus of a
    // button does it again, so neither can say whether this component moved the list.
    await fireEvent.click(row);

    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(scroller.scrollTop).toBe(held);
  },
};
