import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import { entityTypes } from '@/shared/fixtures/entity-types';

import { buildGraphModel, type NodePosition } from './model';
import { deriveRailRows } from './rail-rows';
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

const listOf = (wholeList: readonly string[] = []) => {
  const rows = deriveRailRows(
    model,
    { hiddenTypes: DEFAULT_GRAPH_WORKSPACE.hiddenTypes },
    { openTypes: [TYPE], wholeList },
    null,
    true,
  );
  const list = rows.lists.get(TYPE);
  if (list === undefined) throw new Error(`The rail draws no list for ${TYPE}`);
  return list;
};

const LIST = listOf();

const onSelect = fn();
const onShowWholeList = fn();

const meta = {
  component: IndexRows,
  args: {
    entities: LIST.entities,
    remainder: LIST.remainder,
    onSelect,
    onShowWholeList,
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
    entities: LIST.entities.map((entity, index) => ({ ...entity, selected: index === 0 })),
  },
  play: async ({ canvasElement }) => {
    const marked = canvasElement.querySelectorAll('[data-row][aria-current="true"]');
    await expect(marked).toHaveLength(1);
  },
};

/** The accessible name says the order, because "Show 40 more" alone does not say which 40. */
export const TheRemainderIsTheControlThatOpensTheList: Story = {
  args: { remainder: 40 },
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

export const AnEmptyListDrawsNothing: Story = {
  args: { entities: [], remainder: 0 },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelectorAll('[data-row]')).toHaveLength(0);
    await expect(canvasElement.querySelector('[data-column]')).toBeNull();
    await expect(canvasElement.querySelector('[data-remainder]')).toBeNull();
  },
};
