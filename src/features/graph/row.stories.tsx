import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';

import { buildGraphModel, GRAPH_PALETTES, type NodePosition } from './model';
import { deriveRailRows } from './rail-rows';
import { IndexRows } from './row';
import { DEFAULT_GRAPH_WORKSPACE } from './workspace';

/**
 * The index of one type on the graph — `docs/graph-surface.md` §4.4.
 *
 * Two of the three differences from the map live here: **the list is capped and the remainder is
 * on the screen**, and **the list is in the order of the degree**, because the useful head of a
 * list on a graph is the hubs.
 *
 * **The read comes from the same modules the caller reads.** `./graph-page` builds the model from
 * `@/shared/fixtures/corpus` and derives the rows with `./rail-rows`, and so does this file. A
 * story that wrote its own rows would check a shape that nothing produces.
 *
 * **No story mounts a live canvas.** `CANVAS.md` holds the reason. This is a sibling of the
 * canvas and takes plain values, so it is storied alone.
 *
 * ## What no story of this file can reach
 *
 * **The cap itself.** `LIST_CAP` is 60 in `./rail-rows`, and the fixture holds far fewer entities
 * of any one type. `TheRemainderIsOnTheScreen` therefore proves the half this component owns — the
 * remainder is on the screen, in words — from a remainder it is given. That the cap produces that
 * number is the interior of `./rail-rows`, and a check of it belongs to the level of the test
 * policy that **#21** leaves open.
 */

/**
 * Where each node is drawn, for this file only.
 *
 * **This is not a guess about #35.** No position reaches a row: it draws a name and a degree. So
 * the story needs a map of the right shape and nothing more.
 */
const positions: ReadonlyMap<string, NodePosition> = new Map(
  corpus.entities.map((entity, index) => [entity.id, { x: index, y: index }]),
);

const model = buildGraphModel(corpus, positions, GRAPH_PALETTES.dark);

/** The type with the most entities, so that the list below is worth ordering. */
const TYPE = (() => {
  const counts = new Map<string, number>();
  for (const entity of corpus.entities) {
    counts.set(entity.type, (counts.get(entity.type) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((one, two) => two[1] - one[1]);
  const first = ranked[0];
  if (first === undefined) throw new Error('The committed corpus holds no entity');
  return first[0];
})();

const listOf = () => {
  const rows = deriveRailRows(
    model,
    { hiddenTypes: DEFAULT_GRAPH_WORKSPACE.hiddenTypes },
    { openType: TYPE },
    null,
    true,
  );
  if (rows.open === null) throw new Error(`The rail draws no list for ${TYPE}`);
  return rows.open;
};

const LIST = listOf();

const onSelect = fn();

const meta = {
  component: IndexRows,
  args: {
    entities: LIST.entities,
    remainder: LIST.remainder,
    count: LIST.count,
    onSelect,
  },
} satisfies Meta<typeof IndexRows>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * §4.4, the third difference: the list is in the order of the degree. The name is the tie-break,
 * so the same corpus gives the same head on every open, which the degree alone does not promise.
 */
export const TheListIsInTheOrderOfTheDegree: Story = {
  play: async ({ canvasElement }) => {
    const drawn = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-row]'));
    await expect(drawn.length).toBe(LIST.entities.length);
    await expect(drawn.length).toBeGreaterThan(1);

    const degrees = LIST.entities.map((entity) => entity.degree);
    const falling = [...degrees].sort((one, two) => two - one);
    await expect(degrees).toStrictEqual(falling);
  },
};

/**
 * A bare number says nothing about what it measures, and this list carries no column header. The
 * name of the figure therefore reaches a reader as hidden words.
 */
export const TheDegreeIsNamedToTheReader: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('degree').length).toBe(LIST.entities.length);
  },
};

/** A row reports the entity, and the caller selects it and moves the camera. */
export const ARowReportsTheEntity: Story = {
  play: async ({ canvasElement, args }) => {
    const first = canvasElement.querySelector<HTMLElement>('[data-row]');
    if (first === null) throw new Error('The list draws no row');
    await userEvent.click(first);
    await expect(args.onSelect).toHaveBeenCalledWith(first.dataset['id']);
  },
};

/** The selected row says so to a reader, and not by its colour alone. */
export const TheSelectedRowSaysSo: Story = {
  args: {
    entities: LIST.entities.map((entity, index) => ({ ...entity, selected: index === 0 })),
  },
  play: async ({ canvasElement }) => {
    const marked = canvasElement.querySelectorAll('[data-row][aria-current="true"]');
    await expect(marked).toHaveLength(1);
  },
};

/**
 * §4.4: the list is capped, and **the remainder is on the screen**. A surface that drops rows in
 * silence is worse than one that says how many it dropped.
 */
export const TheRemainderIsOnTheScreen: Story = {
  args: { remainder: 40 },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/40 more\. Use the field\./)).toBeVisible();
  },
};

/** No remainder, no line. A count of zero dropped rows is not a message. */
export const NoRemainderDrawsNoLine: Story = {
  play: async ({ canvasElement }) => {
    await expect(LIST.remainder).toBe(0);
    await expect(canvasElement.querySelector('[data-remainder]')).toBeNull();
  },
};

/**
 * An empty list says the count and the reason in one sentence. The only cause of an empty list is
 * the field, so the line says how many the type holds.
 */
export const NoNameMatchesSaysHowManyTheTypeHolds: Story = {
  args: { entities: [], remainder: 0 },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText(`No name matches. This type has ${LIST.count} entities.`),
    ).toBeVisible();
  },
};
