import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RefObject } from 'react';
import { expect, fireEvent, userEvent, waitFor } from 'storybook/test';

import { entityTypes } from '@/shared/committed-fixture/entity-types';

import type { MapHandle } from './adapter';
import { MULTIPOLYGON_ID, POLYGON_ID, areaCorpus } from './area-corpus';
import { DEFAULT_IMAGERY, type Imagery } from './imagery';
import type { Ground } from './workspace';
import { GroundControl } from './ground-control';
import { entitiesOfType, project, type GeoLink } from './projection';
import { Rail } from './rail';

// No story mounts a live canvas: `MapHandle` is a type, so the double below is a plain object.
// The rail opens at the stored width, 240px by default, and folds to a 44px strip.
const projection = project(areaCorpus, entityTypes);

interface TestMap {
  /** The rail takes a ref, because `map-page.tsx` keeps the handle in a `useRef`. */
  readonly map: RefObject<MapHandle | null>;
  readonly flown: string[];
  readonly switched: { type: string; visible: boolean }[];
  readonly unitsOpened: { unit: string; open: boolean }[];
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
  // The double opens the units above a selection, as the adapter does.
  let openUnits: ReadonlySet<string> =
    selected === null ? new Set() : projection.hierarchy.revealing(new Set(), selected);
  const unitsOpened: { unit: string; open: boolean }[] = [];
  const listeners = new Set<(id: string | null) => void>();
  const flown: string[] = [];
  const switched: { type: string; visible: boolean }[] = [];
  const linksSwitched: boolean[] = [];
  const grounds: Ground[] = [];
  let current = selected;
  let currentGround: Ground = 'plan';
  let currentImagery: Imagery = DEFAULT_IMAGERY;
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
      if (entity !== undefined && !off.has(entity.type)) {
        openUnits = projection.hierarchy.revealing(openUnits, entity.id);
      }
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
    setUnitOpen: (unit, open) => {
      unitsOpened.push({ unit, open });
      openUnits = open
        ? new Set([...openUnits, unit])
        : projection.hierarchy.closing(openUnits, unit);
    },
    get openUnits() {
      return openUnits;
    },
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
    setImagery: (next) => {
      currentImagery = next;
    },
    get imagery() {
      return currentImagery;
    },
    destroy: () => {
      // The double owns nothing, so it releases nothing.
    },
  };

  return { map: { current: handle }, flown, switched, unitsOpened, linksSwitched, grounds };
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
const unitOnly = testMap([], null);
const polygonOnly = testMap([], POLYGON_ID);
const multipolygonOnly = testMap([], MULTIPOLYGON_ID);
const besidePointsOnly = testMap([], null);

const meta = {
  component: Rail,
  args: {
    projection,
    map: switchOnly.map,
    frame: { open: true, width: 240 },
    onFrameChange: () => {
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

    // The rail opens at the width the caller stored.
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

// Departure: the chain of command is a folder. A closed unit lists no subordinate, because the
// map draws none, and the open goes to the adapter, which is the one holder of the folds.
export const AUnitOpensItsSubordinatesThroughTheOneWriter: Story = {
  args: { map: unitOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const parent = firstOf(UNITS, 'military unit');
    const child = UNITS[1];
    if (child === undefined) throw new Error('The fixture draws fewer than two military units.');

    await userEvent.click(canvas.getByRole('button', { name: 'Open the military_unit list' }));
    await expect(rowsIn(canvasElement)).toHaveLength(1);
    const total = String(UNITS.length);
    await expect(canvas.getByRole('button', { name: /^military_unit/ })).toHaveTextContent(total);

    await userEvent.click(
      canvas.getByRole('button', { name: `Open the 1 subordinate of ${parent.label}` }),
    );

    await expect(unitOnly.unitsOpened).toStrictEqual([{ unit: parent.id, open: true }]);
    await expect(rowsIn(canvasElement).map((row) => row.dataset['id'])).toEqual([
      parent.id,
      child.id,
    ]);
    await expect(canvas.getByRole('button', { name: /^military_unit/ })).toHaveTextContent(total);
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

const rowOf = (root: HTMLElement, id: string): HTMLElement => {
  const row = root.querySelector<HTMLElement>(`[data-id="${id}"]`);
  if (row === null) throw new Error('The index draws no row for this entity.');
  return row;
};

/** The click on the area ends as `select`, so a selection from the map is what the rail reads. */
export const APolygonEntityIsSelectedAndTheRailShowsItsRow: Story = {
  args: { map: polygonOnly.map },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('button', { name: 'Close the facility list' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    const row = rowOf(canvasElement, POLYGON_ID);
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toHaveTextContent('Invented mooring area');
  },
};

export const AMultipolygonEntityIsSelectedAndTheRailShowsItsRow: Story = {
  args: { map: multipolygonOnly.map },
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement, MULTIPOLYGON_ID);
    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(row).toHaveTextContent('Invented anchorage areas');
  },
};

export const APolygonStandsInTheListBesideThePointsOfItsType: Story = {
  args: { map: besidePointsOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const facilities = entitiesOfType(projection, 'facility');
    await userEvent.click(canvas.getByRole('button', { name: 'Open the facility list' }));
    await expect(rowsIn(canvasElement)).toHaveLength(facilities.length);
    await expect(projection.byId.get(POLYGON_ID)?.area).not.toBeNull();
    await expect(projection.byId.get(MULTIPOLYGON_ID)?.area).not.toBeNull();

    await userEvent.click(rowOf(canvasElement, POLYGON_ID));
    await expect(rowOf(canvasElement, POLYGON_ID)).toHaveAttribute('aria-current', 'true');
    await expect(besidePointsOnly.flown).toContain(POLYGON_ID);
  },
};
