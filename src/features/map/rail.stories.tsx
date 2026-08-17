import type { Meta, StoryObj } from '@storybook/react-vite';
import type { RefObject } from 'react';
import { expect, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';

import type { MapHandle } from './adapter';
import {
  entitiesMatching,
  linksOfSelection,
  project,
  railLegend,
  type GeoLink,
} from './projection';
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
  let current = selected;
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
    destroy: () => {
      // The double owns nothing, so it releases nothing.
    },
  };

  return { map: { current: handle }, flown, switched, linksSwitched };
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

const linkRowsIn = (root: HTMLElement): readonly HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-link-row]'));

const undrawableLinksIn = (root: HTMLElement): string =>
  shownCount(root, '[data-undrawable-links]', 'the relations it cannot draw');

/** The number on the switch of the relations, as the reader sees it. */
const relationsIn = (root: HTMLElement): string =>
  shownCount(root, '[data-relations]', 'the relations the map draws');

/** Every type is drawn, unless a story switches one off. */
const allDrawn = (): boolean => true;

const VESSEL = facetOf('vessel');
const VESSELS = entitiesMatching(projection, 'vessel', '');

/**
 * The first entity the fixture gives a drawn relation.
 *
 * **The fixture holds no entity whose relations are all undrawable by the corpus.** Every entity
 * that this projection draws with no relation row carries no relation at all, so the sentence
 * "touches none that can be drawn" is proved below with the case the surface can reach: an entity
 * whose one relation ends at a type that the analyst switches off.
 */
const LINKED = firstOf(
  projection.entities.filter(
    (entity) => linksOfSelection(projection, entity.id, allDrawn).length > 0,
  ),
  'entity with a relation that can be drawn',
);

/** The type of the other endpoint of the first relation of that entity. Switching it off empties
 * the list, because the map then draws no point at the far end of the line. */
const LINKED_OTHER = firstOf(
  linksOfSelection(projection, LINKED.id, allDrawn),
  'relation of the linked entity',
).other;

/**
 * What the switch of the relations must say, before a type goes off and after it.
 *
 * The two numbers come from `railLegend`, which is the derivation the rail reads. A relation is
 * drawn when the map draws both of its endpoints, so the type of `LINKED_OTHER` takes at least one
 * relation off the map.
 */
const RELATIONS_DRAWN = railLegend(projection, allDrawn).drawnLinks;
const RELATIONS_LEFT = railLegend(projection, (type) => type !== LINKED_OTHER.type).drawnLinks;

/**
 * The relation that the analyst chose on the map.
 *
 * **No story can choose one.** The choice comes from a click on a line of a live canvas, and
 * `CANVAS.md` keeps that canvas out of a story. So the double starts with the choice already
 * made, and the story proves what the rail says about it.
 *
 * **It carries a source document and an interval.** The story below proves that neither reaches
 * the screen, and a relation with neither would prove nothing.
 */
const CHOSEN = firstOf(
  projection.links.filter(
    (link) => link.sources.length > 0 && (link.validFrom !== null || link.validTo !== null),
  ),
  'relation that can be drawn, and that carries a source document and an interval',
);

const switchOnly = testMap([], null);
const reachOnly = testMap([], null);
const stripOnly = testMap([], null);
const polarityOnly = testMap(['vessel'], null);
const restoredOnly = testMap([], firstOf(VESSELS, 'vessel').id);
const linksOnly = testMap([], null);
const countOnly = testMap([], null);
const relationCountOnly = testMap([], null);
const listOnly = testMap([], LINKED.id);
const noneOnly = testMap([], LINKED.id);
const chosenOnly = testMap([], null, CHOSEN);

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
 * Criterion 2: "An entity is reached by name in two steps."
 *
 * Step one folds the type open, step two searches inside it. The row then reports the selection,
 * and the rail asks the map to fly to it. **The camera move itself is not in this test**: a double
 * proves the call and not the movement, and the movement is checked in the running application.
 */
export const AnEntityIsReachedByNameInTwoSteps: Story = {
  args: { map: reachOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const target = firstOf(VESSELS, 'vessel');
    const matches = entitiesMatching(projection, 'vessel', target.label);

    // Step one. The field does not exist before it.
    await expect(canvas.queryByRole('textbox', { name: 'Search vessel by name' })).toBeNull();
    await userEvent.click(canvas.getByRole('button', { name: 'Open the vessel list' }));
    await expect(rowsIn(canvasElement)).toHaveLength(VESSELS.length);

    // Step two.
    const field = canvas.getByRole('textbox', { name: 'Search vessel by name' });
    await userEvent.type(field, target.label);
    const narrowed = rowsIn(canvasElement);
    await expect(narrowed).toHaveLength(matches.length);
    await expect(matches.length).toBeLessThan(VESSELS.length);

    const row = firstOf(narrowed, 'row of the index');
    await userEvent.click(row);

    await expect(row).toHaveAttribute('aria-current', 'true');
    await expect(reachOnly.flown).toContain(target.id);
  },
};

/**
 * Criterion 3, and the second clause of the *Check*: "The closed rail still says what is drawn."
 *
 * A bar that closes to nothing turns every colour on the map into a guess. **Only the list is
 * lost**, so the strip keeps every switch — the four types and the relations — and every count.
 * The strip is still a control: a click on it switches the type. A sentence does not fit in 44px,
 * so each count keeps its number on the screen and says its words to the reader.
 */
export const TheClosedRailStillSaysWhatIsDrawn: Story = {
  args: { map: stripOnly.map, open: false },
  play: async ({ canvas, canvasElement }) => {
    await document.fonts.ready;

    // The width of the closed rail is part of the contract: a 44px strip.
    const rail = canvas.getByRole('complementary', { name: 'Layers' });
    await expect(Math.round(rail.getBoundingClientRect().width)).toBe(44);

    for (const facet of projection.types) {
      const entry = canvas.getByRole('button', {
        name: `${facet.type}, ${facet.count} on the map`,
      });
      await expect(entry).toHaveAttribute('aria-pressed', 'true');
      await expect(entry).toHaveTextContent(String(facet.count));
    }

    // The relations keep their switch, and it is the same act as in the open state.
    const relations = canvas.getByRole('button', {
      name: `relations, ${projection.links.length} on the map`,
    });
    await expect(relations).toHaveAttribute('aria-pressed', 'true');
    await expect(relations).toHaveTextContent(String(projection.links.length));
    await userEvent.click(relations);
    await expect(stripOnly.linksSwitched).toEqual([false]);
    await expect(relations).toHaveAttribute('aria-pressed', 'false');

    // Each count of the footer keeps its number on the screen, and its words reach the reader.
    await expect(drawnIn(canvasElement)).toBe(String(projection.entities.length));
    await expect(undrawableLinksIn(canvasElement)).toBe(String(projection.undrawableLinks));
    await expect(
      canvas.getByText(
        `${projection.entities.length} of ${projection.entities.length} entities drawn`,
      ),
    ).toBeInTheDocument();
    await expect(
      canvas.getByText(new RegExp(`^${projection.undrawableLinks} more relations cannot be drawn`)),
    ).toBeInTheDocument();

    // The list is what the closed state loses, and only the list.
    await expect(canvas.queryByRole('textbox')).toBeNull();

    const vessel = canvas.getByRole('button', { name: `vessel, ${VESSEL.count} on the map` });
    await userEvent.click(vessel);
    await expect(stripOnly.switched).toContainEqual({ type: 'vessel', visible: false });
    await expect(vessel).toHaveAttribute('aria-pressed', 'false');
    // The count of what is drawn answers the switch here too.
    await expect(drawnIn(canvasElement)).toBe(String(projection.entities.length - VESSEL.count));
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
 * §4.7: "Relations are not entity types, and they do not enter the type list. … Links get one
 * switch of their own."
 *
 * The switch stands outside the list of the types, it names how many relations the map can draw,
 * and it acts through the handle. The rail writes no workspace field: `adapter.ts` is the only
 * writer of `linksHidden`.
 */
export const TheRelationsHaveOneSwitchOfTheirOwn: Story = {
  args: { map: linksOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const relations = canvas.getByRole('button', { name: /^relations/ });

    // It is not an entry of the type list. Each entry of that list sits inside its own group.
    await expect(relations.closest('[data-facet]')).toBeNull();
    await expect(relations).toHaveTextContent(String(projection.links.length));
    await expect(relations).toHaveAttribute('aria-pressed', 'true');

    await userEvent.click(relations);
    await expect(linksOnly.linksSwitched).toEqual([false]);
    await expect(relations).toHaveAttribute('aria-pressed', 'false');

    // The switch hides the lines, and it hides no evidence: the dropped count stays on the screen.
    await expect(undrawableLinksIn(canvasElement)).toBe(String(projection.undrawableLinks));
  },
};

/**
 * §5.1, applied to the switch of the relations: a number that is not on the map is a lie on the
 * screen.
 *
 * **The two counts of this rail answer two questions, and one act proves both.** A type goes off,
 * and the relations count falls with the entity count, because a relation needs both of its
 * endpoints on the map. The count of the relations that no map can draw stays, because §3.3 counts
 * it in the corpus and a type switch changes no fact of the corpus.
 *
 * Each assertion reads the text that the analyst sees, and never a `data-` attribute alone.
 */
export const TheRelationsCountFallsWithTheTypeSwitchAndTheCorpusCountStays: Story = {
  args: { map: relationCountOnly.map },
  play: async ({ canvas, canvasElement }) => {
    await expect(RELATIONS_LEFT).toBeLessThan(RELATIONS_DRAWN);

    await expect(relationsIn(canvasElement)).toBe(String(RELATIONS_DRAWN));
    await expect(drawnIn(canvasElement)).toBe(String(projection.entities.length));
    await expect(undrawableLinksIn(canvasElement)).toBe(String(projection.undrawableLinks));

    const other = facetOf(LINKED_OTHER.type);
    await userEvent.click(canvas.getByRole('button', { name: new RegExp(`^${other.type}`) }));

    // The relations count now states what the map draws, and the entity count falls with it.
    await expect(relationsIn(canvasElement)).toBe(String(RELATIONS_LEFT));
    await expect(drawnIn(canvasElement)).toBe(String(projection.entities.length - other.count));

    // The switch itself is still on, and the label says the two facts: how many are drawn now,
    // and the state of the switch. The whole line is read, because the word `on` is inside the
    // word `relations` and a search for it alone proves nothing.
    const relations = canvas.getByRole('button', { name: /^relations/ });
    await expect(relations).toHaveAttribute('aria-pressed', 'true');
    await expect(relations).toHaveTextContent(new RegExp(`^relations${RELATIONS_LEFT}on$`));

    // The corpus count keeps its number and its sentence. The number sits in its own element, so
    // the sentence is read beside it and never with it.
    await expect(undrawableLinksIn(canvasElement)).toBe(String(projection.undrawableLinks));
    await expect(canvas.getByText(/^more relations cannot be drawn here\./)).toBeVisible();
  },
};

/**
 * The second clause of the *Check* of step 8: "the count that cannot be drawn is on screen."
 *
 * §3.3: a map that drops evidence in silence is worse than one that says how much it dropped. M4
 * permits a relation to point at a relation, and such a relation has no second point.
 *
 * **The sentence says only what one number can carry.** The count cannot separate a relation that
 * points at a relation from one whose endpoint carries no geometry, and from one whose endpoint
 * the corpus does not hold. So it names the fact that covers the three.
 */
export const TheCountThatCannotBeDrawnIsOnScreen: Story = {
  args: { map: countOnly.map },
  play: async ({ canvas, canvasElement }) => {
    await expect(projection.undrawableLinks).toBeGreaterThan(0);

    await expect(undrawableLinksIn(canvasElement)).toBe(String(projection.undrawableLinks));
    // The count is in words, and the sentence says what the number supports.
    await expect(
      canvas.getByText(/Each one has an endpoint that this map draws nowhere/),
    ).toBeVisible();
  },
};

/**
 * The first clause of the "Works when": "Selecting an entity brightens its links and lists them",
 * and the third: "The endpoints move the selection."
 *
 * The map brightens, and no story can reach that. The rail lists, and each row names the **other**
 * endpoint. Choosing a row selects that entity through the handle, and the rail asks the map to
 * fly to it. **No row carries the relation type, the interval or the source documents**: that is
 * the card of §4.7, and §7 keeps its owner open.
 */
export const TheSelectedEntityListsItsRelations: Story = {
  args: { map: listOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const mine = linksOfSelection(projection, LINKED.id, allDrawn);
    await expect(linkRowsIn(canvasElement)).toHaveLength(mine.length);

    const first = firstOf(mine, 'relation of the selected entity');
    const other = first.other;
    // The number the reader sees says how many rows are under it.
    await expect(shownCount(canvasElement, '[data-links]', 'the relations of the selection')).toBe(
      String(mine.length),
    );
    await expect(canvas.getByText(/on the selected entity/)).toBeVisible();

    // The name of the row says the relation, the way it points and the other endpoint. §4.7 gives
    // the interval and the source documents to a card that §7 has no owner for, so no row says
    // either one.
    const row = canvas.getByRole('button', {
      name: `${first.type} ${first.direction === 'out' ? 'to' : 'from'} ${other.label}`,
    });
    await userEvent.click(row);

    // The endpoint moved the selection, and the camera followed it.
    await expect(listOnly.map.current?.selected).toBe(other.id);
    await expect(listOnly.flown).toContain(other.id);
  },
};

/**
 * The same clause, for an entity whose relations exist and cannot be drawn. §3.3 and the skill:
 * one sentence that says the count and the reason, and never an emoji, an illustration or nothing.
 *
 * **The list starts full and it empties**, so a rail that listed nothing for every entity would
 * fail here. The type of the other endpoint switches off, the map draws no point at that end, and
 * a row that offered it would fly the camera to an empty place and lose the selection.
 */
export const TheSelectedEntityTouchesNoneThatCanBeDrawn: Story = {
  args: { map: noneOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const mine = linksOfSelection(projection, LINKED.id, allDrawn);
    await expect(linkRowsIn(canvasElement)).toHaveLength(mine.length);
    await expect(mine.length).toBeGreaterThan(0);

    await userEvent.click(
      canvas.getByRole('button', { name: new RegExp(`^${LINKED_OTHER.type}`) }),
    );

    await expect(
      canvas.getByText('The selected entity touches none that can be drawn.'),
    ).toBeVisible();
    await expect(linkRowsIn(canvasElement)).toHaveLength(0);
    // The selection stays, because the entity itself is of a type that the map still draws.
    await expect(noneOnly.map.current?.selected).toBe(LINKED.id);
  },
};

/**
 * The ruling of the operator: a chosen relation is brightened on the map and **named in the
 * rail**, and there is no card.
 *
 * The bright line is on the live canvas, and no story can reach it. This story proves the naming:
 * the type and the two endpoints, and no interval, no attribute and no source document. Switching
 * the relations off ends the choice, because the rail must name no line that the map draws
 * nowhere.
 */
export const AChosenRelationIsNamedInTheRail: Story = {
  args: { map: chosenOnly.map },
  play: async ({ canvas, canvasElement }) => {
    const named = canvasElement.querySelector<HTMLElement>('[data-chosen-link]');
    await expect(named).toHaveAttribute('data-chosen-link', CHOSEN.id);
    await expect(named).toHaveTextContent(CHOSEN.from.label);
    await expect(named).toHaveTextContent(CHOSEN.to.label);
    await expect(named).toHaveTextContent(CHOSEN.type);

    // **The card of the prototype is what §4.7 refuses.** The whole text of the rail is read
    // here, and never one element of it: a rail that wrote `sources: doc-1, doc-2` on one line
    // would pass a query for the identifier alone. No source document, and no end of the
    // interval, reaches the screen. M6 asks for both ends of an interval, and the answer of this
    // surface is that it writes neither.
    const written = canvasElement.textContent;
    for (const source of CHOSEN.sources) {
      await expect(written).not.toContain(source);
    }
    for (const edge of [CHOSEN.validFrom, CHOSEN.validTo]) {
      if (edge === null) continue;
      await expect(written).not.toContain(edge);
    }

    await userEvent.click(canvas.getByRole('button', { name: /^relations/ }));
    await expect(canvasElement.querySelector('[data-chosen-link]')).toBeNull();
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
