import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RefObject } from 'react';
import { expect, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';

import type { MapHandle } from './adapter';
import type { Ground } from './workspace';
import { entitiesOfType, project, type GeoLink } from './projection';
import { Rail } from './rail';

/**
 * The "Works when" of `docs/map-surface.md` §4.5, and the *Check* of step 6 of §8.
 *
 * The read arrives through `project()` over `@/shared/fixtures/corpus`, which is what the caller
 * of this component reads. Both change on the day `src/contract/` replaces the fixture.
 *
 * **No story mounts a live canvas.** `MapHandle` is a type, so this file loads no library: the
 * `import type` above is erased, and the double below is a plain object. What a double cannot
 * prove is the camera. "A row selects an entity **and moves the camera to it**" is checked here
 * as far as the seam — the rail asks the map to fly — and the move itself is proved in the
 * running application.
 *
 * **The width is part of the contract.** The rail is 240px open (`w-60`) and a 44px strip closed
 * (`w-11`), and the two stories below measure the two.
 */
const projection = project(corpus);

interface TestMap {
  /**
   * The handle, in a ref. The rail takes the ref, because `map-page.tsx` keeps the instance in a
   * `useRef` and never in React state above the canvas — `CANVAS.md`. A plain object is that ref
   * here: the rail reads `current`, and it writes nothing.
   */
  readonly map: RefObject<MapHandle | null>;
  /** Each identifier the rail asked the map to fly to, in order. */
  readonly flown: string[];
  /** Each switch the rail asked for. The rail writes no workspace field of its own. */
  readonly switched: { type: string; visible: boolean }[];
  /** Each switch of the relations. `adapter.ts` is the only writer of `linksHidden`. */
  readonly linksSwitched: boolean[];
  /** Each ground the rail asked for. `adapter.ts` is the only writer of `ground`. */
  readonly grounds: Ground[];
}

/**
 * A handle that answers like `adapter.ts` and owns no library.
 *
 * It keeps the two behaviours the rail depends on: `onSelect` calls its listener at once with the
 * selection of that moment (§5.1), and a type that is switched off drops a selection of that type
 * (§5.1). It holds the types that are switched **off**, which is the polarity of §5.2.
 */
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

  /** The adapter ends the choice of a relation when it hides each line. The double does too. */
  const dropChoice = (): void => {
    if (chosenLink === null) return;
    chosenLink = null;
    for (const listener of chooseListeners) listener(null);
  };

  const announce = (id: string | null): void => {
    if (id === current) return;
    current = id;
    // A new selection ends the choice of a relation, exactly as `adapter.ts` states.
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
      // The adapter refuses a flight to an entity of a type that is switched off, exactly as
      // `select` refuses the same identifier. The double holds the same rule.
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
    // The ground is a layout property of the live style, so the double holds the value and
    // records nothing else: the rail reads it to name the switch, and writes it on a click.
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

/**
 * The number the reader sees, and never the attribute beside it.
 *
 * A count that is asserted from a `data-` attribute proves the attribute. The number is a separate
 * expression, so a mutation of that expression passes such a test. This helper reads the text of
 * the element that carries the number, which is what the analyst reads.
 */
const shownCount = (root: HTMLElement, line: string, what: string): string => {
  const figure = root.querySelector<HTMLElement>(`${line} [data-count]`);
  if (figure === null) throw new Error(`The rail shows no count of ${what}.`);
  return figure.textContent;
};

const drawnIn = (root: HTMLElement): string =>
  shownCount(root, '[data-drawn]', 'what the map draws');

const VESSEL = facetOf('vessel');
const VESSELS = entitiesOfType(projection, 'vessel');

const switchOnly = testMap([], null);
const reachOnly = testMap([], null);
/** One double per story, so that one story never reads what another one wrote. */
const groundOnly = testMap([], null);
const polarityOnly = testMap(['vessel'], null);
const restoredOnly = testMap([], firstOf(VESSELS, 'vessel').id);

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

/**
 * §4.3: two grounds, and one control between them.
 *
 * **The switch goes through the one writer.** The rail writes no workspace field: it calls the
 * handle, and `adapter.ts` moves the layout property of the two ground layers and stores the
 * choice. The double records each ground the rail asked for.
 *
 * **The credit is not asserted here, and no story can reach it.** MapLibre draws the attribution
 * over the canvas, from the source of whichever ground layer is visible, and `CANVAS.md` keeps a
 * live canvas out of every story. The running application is what proves that the credit on
 * screen matches the ground on screen — §5.5.
 */
export const TheGroundSwitchesThroughTheOneWriter: Story = {
  args: { map: groundOnly.map },
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

/**
 * Criterion 1: "A type switches off and the count says so."
 *
 * The switch is one control with the type, the count and the word `on`, so the assertion reads
 * the accessible name and `aria-pressed`, and never a class and never a colour. The count that
 * answers the switch is the count of what the map draws now.
 */
export const ATypeSwitchesOffAndTheCountSaysSo: Story = {
  args: { map: switchOnly.map },
  play: async ({ canvas, canvasElement }) => {
    await document.fonts.ready;

    // The width of the open rail is part of the contract: 240px.
    const rail = canvas.getByRole('complementary', { name: 'Layers' });
    await expect(Math.round(rail.getBoundingClientRect().width)).toBe(240);

    await expect(drawnIn(canvasElement)).toBe(String(projection.entities.length));

    const vessel = canvas.getByRole('button', { name: /^vessel/, pressed: true });
    await userEvent.click(vessel);

    await expect(drawnIn(canvasElement)).toBe(String(projection.entities.length - VESSEL.count));
    await expect(canvas.getByRole('button', { name: /^vessel/, pressed: false })).toBeVisible();

    // The count of the corpus stays beside the type: it says what the corpus holds where the map
    // now draws nothing — §3.1.
    await expect(canvas.getByRole('button', { name: /^vessel/ })).toHaveTextContent(
      String(VESSEL.count),
    );
  },
};

/**
 * The index opens in one step, and a row of it reaches the entity.
 *
 * **The second step used to be a search field, and it is gone** — #82 C6, Not here. The operator
 * does not want a search inside this rail, and **#90 GLOBAL-SEARCH** holds a search across the
 * corpus. So the chevron opens the whole list of the type, and a row of it selects the entity and
 * moves the camera.
 */
export const AnEntityIsReachedFromTheOpenList: Story = {
  args: { map: reachOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const target = firstOf(VESSELS, 'vessel');

    await userEvent.click(canvas.getByRole('button', { name: 'Open the vessel list' }));
    const drawn = rowsIn(canvasElement);
    await expect(drawn).toHaveLength(VESSELS.length);
    // #82 C6: the rail carries no field at all.
    await expect(canvasElement.querySelector('input')).toBeNull();

    const row = firstOf(drawn, 'row of the index');
    await userEvent.click(row);

    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(reachOnly.flown).toContain(target.id);
  },
};

/**
 * The first clause of the *Check*: "the polarity of §5.2".
 *
 * The map holds the types that are switched **off**. A type the map never names is drawn, so a
 * type that the corpus gains is never hidden by a stale list. The rail keeps that polarity and
 * writes no store of its own: the switch is one call of `setTypeVisible`, which `adapter.ts`
 * declares itself the sole writer for.
 */
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

/**
 * §5.1: "A component that subscribes after the map is built has already missed the restore. Seed
 * from the current selection, then subscribe."
 *
 * A rail that only listened opened no group on a reload. The map carries a selection here before
 * the rail exists, and the group of that type is open at the first render.
 */
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
