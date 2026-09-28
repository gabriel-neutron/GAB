import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { buildGraphModel, type NodePosition } from './model';
import { deriveRailRows, type RailView } from './rail-rows';
import { IndexRows } from './row';
import { DEFAULT_GRAPH_WORKSPACE } from './workspace';

/** No position reaches a row. The story needs a map of the right shape and nothing more. */
const positions: ReadonlyMap<string, NodePosition> = new Map(
  corpus.entities.map((entity, index) => [entity.id, { x: index, y: index }]),
);

const model = buildGraphModel(corpus, positions, entityTypes, 'dark');

/** The most populated type, so that the order of the list below is worth a check. */
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

const VIEW: RailView = {
  filter: { hiddenTypes: DEFAULT_GRAPH_WORKSPACE.hiddenTypes },
  selection: null,
  openUnits: new Set(),
  railOpen: true,
  railWidth: DEFAULT_GRAPH_WORKSPACE.railWidth,
};

const listOf = (wholeList: readonly string[] = [], type = TYPE, view = VIEW) => {
  const rows = deriveRailRows(model, view, { openTypes: [type], wholeList }, '');
  const list = rows.lists.get(type);
  if (list === undefined) throw new Error(`The rail draws no list for ${type}`);
  return list;
};

const LIST = listOf();

const onSelect = fn();
const onShowWholeList = fn();
const onOpen = fn();

const meta = {
  component: IndexRows,
  args: {
    list: LIST,
    onSelect,
    onShowWholeList,
    onOpen,
  },
} satisfies Meta<typeof IndexRows>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The name breaks a tie, so the same corpus gives the same head on every open. */
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

/** A bare number does not say what it measures. One header names the column on the screen. */
export const TheFigureIsNamedOnTheScreen: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Relations')).toBeVisible();
    await expect(canvasElement.querySelectorAll('[data-column]')).toHaveLength(1);
  },
};

export const ARowReportsTheEntity: Story = {
  play: async ({ canvasElement, args }) => {
    const first = canvasElement.querySelector<HTMLElement>('[data-row]');
    if (first === null) throw new Error('The list draws no row');
    await userEvent.click(first);
    await expect(args.onSelect).toHaveBeenCalledWith(first.dataset['id']);
  },
};

export const TheSelectedRowSaysSo: Story = {
  args: {
    list: {
      ...LIST,
      entities: LIST.entities.map((entity, index) => ({ ...entity, selected: index === 0 })),
    },
  },
  play: async ({ canvasElement }) => {
    const marked = canvasElement.querySelectorAll('[data-row][aria-current="true"]');
    await expect(marked).toHaveLength(1);
  },
};

/** The accessible name says the order, because "Show 40 more" alone does not say which 40. */
export const TheRemainderIsTheControlThatOpensTheList: Story = {
  args: { list: { ...LIST, remainder: 40 } },
  play: async ({ canvas, args }) => {
    const control = canvas.getByRole('button', {
      name: 'Show the remaining 40, most connected first',
    });
    await expect(control).toBeVisible();
    await expect(control).toHaveTextContent('Show 40 more');
    await expect(control).not.toHaveTextContent('field');

    await userEvent.click(control);
    await expect(args.onShowWholeList).toHaveBeenCalled();
  },
};

/** The corpus is smaller than the cap, so the two lists are equal here. */
export const TheWholeListKeepsTheOrder: Story = {
  play: async () => {
    const whole = listOf([TYPE]);
    await expect(whole.remainder).toBe(0);
    const degrees = whole.entities.map((entity) => entity.degree);
    await expect(degrees).toStrictEqual([...degrees].sort((one, two) => two - one));
  },
};

export const NoRemainderDrawsNoLine: Story = {
  play: async ({ canvasElement }) => {
    await expect(LIST.remainder).toBe(0);
    await expect(canvasElement.querySelector('[data-remainder]')).toBeNull();
  },
};

export const AnEmptyListSaysNoNameMatches: Story = {
  args: { list: { ...LIST, entities: [], remainder: 0 } },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-no-match]')).not.toBeNull();
    await expect(canvasElement.querySelectorAll('[data-row]')).toHaveLength(0);
    await expect(canvasElement.querySelector('[data-column]')).toBeNull();
    await expect(canvasElement.querySelector('[data-remainder]')).toBeNull();
  },
};

const UNIT_TYPE = 'military_unit';

const PARENT = (() => {
  const found = model.graph
    .nodes()
    .find(
      (node) =>
        model.graph.getNodeAttribute(node, 'entityType') === UNIT_TYPE &&
        model.hierarchy.subordinatesOf(node).length > 0,
    );
  if (found === undefined) throw new Error('The committed corpus holds no unit with a subordinate');
  return found;
})();

// Departure: the chain of command is a folder of the list. A closed unit lists no subordinate,
// the canvas still draws each one, and the control reports the open to the caller.
export const AClosedUnitListsNoSubordinate: Story = {
  args: { list: listOf([], UNIT_TYPE) },
  play: async ({ canvasElement, args }) => {
    const toggle = canvasElement.querySelector<HTMLElement>(`[data-folder="${PARENT}"]`);
    if (toggle === null) throw new Error('The list draws no fold control for the unit');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(canvasElement.querySelector('[data-depth]')).toBeNull();

    await userEvent.click(toggle);
    await expect(args.onOpen).toHaveBeenCalledWith(PARENT, true);
  },
};

export const AnOpenUnitListsItsSubordinateOneLevelDown: Story = {
  args: { list: listOf([], UNIT_TYPE, { ...VIEW, openUnits: new Set([PARENT]) }) },
  play: async ({ canvasElement }) => {
    const [child] = model.hierarchy.subordinatesOf(PARENT);
    const rows = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-row]'));
    const ids = rows.map((row) => row.dataset['id']);
    await expect(ids.indexOf(child)).toBe(ids.indexOf(PARENT) + 1);
    await expect(canvasElement.querySelector('[data-depth="1"]')).not.toBeNull();
  },
};
