import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, fn, within } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import type { Entity } from '@/shared/fixtures/types';
import { cn } from '@/shared/lib/utils';

import type { FilterState } from './controller';
import { buildGraphModel, GRAPH_PALETTES, type NodePosition } from './model';
import { Rail, type RailAct, type RailProps } from './rail';
import { deriveRailRows, type RailOpenList, type RailRows, type RailStep } from './rail-rows';
import { DEFAULT_GRAPH_WORKSPACE } from './workspace';

/**
 * The states of the layer rail of the graph.
 *
 * Built from `docs/graph-surface.md` §4.4 (the component and its "Works when"), §5.1, §5.2 and
 * the *Check* of §8 step 5. Each export below is named for the criterion it proves.
 *
 * **The read comes from the same module the caller reads.** `./graph-page` imports
 * `@/shared/fixtures/corpus`, and so does this file, so both change on the day `src/contract/`
 * replaces the fixtures. Every row below is built by `./rail-rows`, which is the derivation the
 * caller uses: a story that wrote its own rows would check a shape that nothing produces.
 *
 * **No story mounts a live canvas.** `CANVAS.md` holds the reason. The rail is a sibling of the
 * canvas and takes plain values, so it is storied alone.
 *
 * **Each assertion reads the contract**: a role, an accessible name, `aria-pressed`,
 * `aria-expanded`, `aria-controls`, a `title` and the text. No story reads a class and none reads
 * a colour.
 *
 * ## What no story of this file can reach
 *
 * - **"No type carries a colour", §4.4, the first difference.** `rail.tsx` draws no swatch, and it
 *   draws no `data-` attribute and no role for one either, so a story cannot name the element that
 *   must be absent. `NoTypeCarriesAColour` states the whole content of a type row instead: the
 *   type, the count and the word. A row that carried a hue would carry an element as well, and the
 *   exact text of the row is what this file can hold. That the hue of this canvas is the community
 *   is proved by `model.ts`, which paints a node from `structure.community`, and by the canvas,
 *   which `CANVAS.md` sends to the `visual-qa` agent.
 * - **The cap of the list, §4.4, the second difference.** `LIST_CAP` is 60 in `./rail-rows`, and
 *   the fixture holds 27 entities over four types. No derivation from this read can fill the cap.
 *   `TheRemainderIsOnScreen` therefore proves the half of the rule that this component owns — the
 *   remainder is on the screen, in words — from rows that state a remainder. That the cap produces
 *   that number is the interior of `./rail-rows`, and a check of it belongs to the level of the
 *   test policy that **#21** leaves open.
 * - **The camera moves to the entity of a row, §4.4 and §5.1.** The rail reports the act and moves
 *   nothing: `./graph-page` calls `flyTo`. `AnEntityIsReachedByNameInTwoSteps` proves the act, and
 *   the move is proved by the controller and by the canvas.
 */

/**
 * Where each node is drawn, for this file only.
 *
 * **This is not a guess about #35.** No position reaches the rail: it draws a name, a count and a
 * degree. So the story needs a map of the right shape and nothing more.
 */
const positionsOf = (entities: readonly Entity[]): ReadonlyMap<string, NodePosition> =>
  new Map(entities.map((entity, index) => [entity.id, { x: index, y: index }]));

/** The model the rows are derived from. §4.3 gives the ground to the controller, so this states it. */
const model = buildGraphModel(corpus, positionsOf(corpus.entities), GRAPH_PALETTES.light);

/** Every type the read carries. The type list is a projection of the data — §5.2. */
const TYPES: readonly string[] = [...new Set(corpus.entities.map((entity) => entity.type))];

/** The first step of the rail: the type rows only, and no field — §4.4. */
const FIRST_STEP: RailStep = { openType: null, query: '' };

/**
 * The filter of §5.2 holds the types that are **off**, so an empty list hides nothing.
 *
 * **The filter is one field.** A degree floor and a pending switch were fields of `FilterState`,
 * and no control ever wrote either: a stored degree floor dimmed the whole corpus on every open
 * with no way back, and a pending switch presumes an answer to **#42**, which is open. Neither
 * belongs in a fixture of this file either, so the shape below is the shape `./controller`
 * declares and nothing more.
 */
const hiding = (hiddenTypes: readonly string[]): FilterState => ({ hiddenTypes });

/** The type this file unfolds. The read carries eight of them, with a spread of degrees. */
const OPEN_TYPE = 'vessel';

/** One entity of the read, by the name a row draws. */
const entityNamed = (label: string): Entity => {
  const found = corpus.entities.find((entity) => entity.label === label);
  if (found === undefined) throw new Error(`The read holds no entity named "${label}".`);
  return found;
};

/** How many entities of one type the canvas draws. Every entity of this file carries a position. */
const countOf = (type: string): number =>
  corpus.entities.filter((entity) => entity.type === type).length;

const baseRows = deriveRailRows(model, hiding([]), FIRST_STEP, null);
const openRows = deriveRailRows(model, hiding([]), { openType: OPEN_TYPE, query: '' }, null);
const everyTypeOffRows = deriveRailRows(model, hiding(TYPES), FIRST_STEP, null);

/**
 * Rows where one type is off and the others stay on.
 *
 * The folded strip is read in both states from one set of rows, so the polarity of §5.2 — the
 * filter holds the types that are **off** — cannot pass while it is written backwards.
 */
const oneTypeOffRows = deriveRailRows(model, hiding([OPEN_TYPE]), FIRST_STEP, null);

const openListOfRows = (rows: RailRows): RailOpenList => {
  if (rows.open === null) throw new Error('The rows carry no unfolded type.');
  return rows.open;
};

/**
 * Rows that state a remainder.
 *
 * The cap of `./rail-rows` is 60 and this type carries eight entities, so the derivation cannot
 * reach this state from the read. The drawn list is shortened here, and the remainder says how
 * many match and are not drawn. **The rule this proves is the one the component owns**: a surface
 * that drops rows in silence is worse than one that says how many it dropped.
 */
const DRAWN_WHEN_CAPPED = 3;
const cappedRows: RailRows = {
  ...openRows,
  open: {
    ...openListOfRows(openRows),
    entities: openListOfRows(openRows).entities.slice(0, DRAWN_WHEN_CAPPED),
    remainder: openListOfRows(openRows).entities.length - DRAWN_WHEN_CAPPED,
  },
};

/** The control that carries an element with this `title`. A row is a button — the skill. */
const buttonAround = (element: Element | null, what: string): HTMLElement => {
  const control = element?.closest('button') ?? null;
  if (control === null) throw new Error(`The rail draws no control for "${what}".`);
  return control;
};

/** The switch of one type. The row states the type under `title`, on the folded strip as well. */
const typeSwitch = (root: HTMLElement, type: string): HTMLElement =>
  buttonAround(within(root).getByTitle(type), type);

/** The region the chevron of a type opens. The control names it with `aria-controls`. */
const openListOf = (root: HTMLElement, type: string): HTMLElement => {
  const chevron = within(root).getByRole('button', { name: `Close the ${type} list` });
  const id = chevron.getAttribute('aria-controls');
  const list = id === null ? null : root.querySelector(`#${id}`);
  if (!(list instanceof HTMLElement)) throw new Error(`The rail unfolds no list for "${type}".`);
  return list;
};

/** The row of one entity, by the name it draws. */
const entityRow = (list: HTMLElement, label: string): HTMLElement =>
  buttonAround(within(list).getByTitle(label), label);

/** A figure is the only pure number in a row, so a row tells its spans apart. */
const FIGURE = /^\d+$/;

/**
 * What a type row says about its own state, in words — §4.4, "Works when".
 *
 * The count cannot say it: §5.2 dims and never hides, so the count is the same for a type that is
 * off. So the row states the consequence, and this file states the same two words one time.
 */
const wordFor = (on: boolean): string => (on ? 'on' : 'off, dimmed');

/**
 * What the folded strip says about its own state, in the accessible name — §4.4 and §5.2.
 *
 * The strip has room for one letter, so the state of the type reaches a reader through the name of
 * the control and through nothing else. The two names are written one time here, and the story
 * below reads each of them from the rows.
 */
const foldedNameFor = (type: string, on: boolean): string =>
  on ? `${type}, on` : `${type}, off and dimmed`;

/**
 * The rail, with the values its caller holds.
 *
 * `./graph-page` holds the filter, through the `controller` of §4.3, and it holds the two steps of
 * the rail in React state. **The rail itself holds nothing**, so a criterion that spans two acts —
 * switch a type off and read the row again, unfold a type and type in its field — needs the caller
 * beside it. This is that caller, and no more of it: it applies the act, and it reports every act
 * to the spy of the story.
 */
function RailUnderTest({ open, onOpenChange, onAct }: Omit<RailProps, 'rows'>) {
  const [hiddenTypes, setHiddenTypes] = useState<readonly string[]>([]);
  const [step, setStep] = useState<RailStep>(FIRST_STEP);

  const rows = deriveRailRows(model, hiding(hiddenTypes), step, null);

  const act = (next: RailAct): void => {
    onAct(next);
    switch (next.kind) {
      case 'hide-types':
        // §5.2: the filter holds the types that are off, and `./rail-rows` built the set.
        setHiddenTypes(next.hiddenTypes);
        return;
      case 'open-type':
        setStep({ openType: next.type, query: '' });
        return;
      case 'change-query':
        setStep((held) => ({ openType: held.openType, query: next.query }));
        return;
      case 'select-entity':
        // The camera and the selection belong to the controller. The spy above holds the act.
        return;
    }
  };

  return <Rail rows={rows} open={open} onOpenChange={onOpenChange} onAct={act} />;
}

const meta = {
  component: Rail,

  // §4.4 puts the rail down the left of the canvas, and the layout of a story is `centered`. **The
  // width is part of the contract and the component states it**: 16rem unfolded (`w-64`), and
  // 2.75rem folded (`w-11`). The frame states the **height** only, which is 24rem here, because
  // the rail is `max-h-full` and its list scrolls inside that height.
  decorators: [
    (Story) => (
      <div className={cn('flex h-96')}>
        <Story />
      </div>
    ),
  ],

  args: {
    rows: baseRows,
    open: true,
    onOpenChange: fn(),
    onAct: fn(),
  },
} satisfies Meta<typeof Rail>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * §4.4 "Works when", clause a, word for word: "A type switches off, and the count beside it says
 * so."
 *
 * The row states the switch with `aria-pressed`, which a reader hears, and **it states the
 * consequence in words**: `on`, and `off, dimmed`. The count itself cannot say it, because §5.2
 * makes a filter dim and never hide, so the count is honest and does not change. The strike
 * through the row said it to a reader who sees the strike and to nobody else, so this story reads
 * the words and never a class.
 *
 * The act carries the whole hidden set, in the polarity of §5.2 — the types that are **off**.
 */
export const ATypeSwitchesOffAndTheCountSaysSo: Story = {
  render: ({ open, onOpenChange, onAct }) => (
    <RailUnderTest open={open} onOpenChange={onOpenChange} onAct={onAct} />
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const count = String(countOf(OPEN_TYPE));

    const control = typeSwitch(canvasElement, OPEN_TYPE);
    await expect(control).toHaveAttribute('aria-pressed', 'true');
    await expect(within(control).getByText(count)).toBeInTheDocument();
    await expect(within(control).getByText(wordFor(true))).toBeInTheDocument();

    await userEvent.click(control);

    await expect(args.onAct).toHaveBeenCalledWith({
      kind: 'hide-types',
      hiddenTypes: [OPEN_TYPE],
    });

    const after = typeSwitch(canvasElement, OPEN_TYPE);
    await expect(after).toHaveAttribute('aria-pressed', 'false');
    await expect(within(after).getByText(count)).toBeInTheDocument();
    await expect(within(after).getByText(wordFor(false))).toBeInTheDocument();
  },
};

/**
 * §4.4 "Works when", clause b: "An entity is reached by name in two steps."
 *
 * The two steps are the chevron and the field. §4.4 keeps the field for the type that is open,
 * because a filter over one type is a different question from a search over the corpus, which §9
 * leaves to W9.
 *
 * The row reports `select-entity` with the identifier of the entity it names. **The camera is not
 * this component's**: §5.1 lets a control move it, and `./graph-page` calls `flyTo` on this act.
 */
export const AnEntityIsReachedByNameInTwoSteps: Story = {
  render: ({ open, onOpenChange, onAct }) => (
    <RailUnderTest open={open} onOpenChange={onOpenChange} onAct={onAct} />
  ),
  play: async ({ args, canvasElement, userEvent }) => {
    const wanted = entityNamed('MV Kestrel Arrow');

    await userEvent.click(
      within(canvasElement).getByRole('button', { name: `Open the ${OPEN_TYPE} list` }),
    );

    const field = within(canvasElement).getByRole('textbox', {
      name: `Filter ${OPEN_TYPE} by name`,
    });
    await userEvent.type(field, 'Kestrel');

    const list = openListOf(canvasElement, OPEN_TYPE);
    const row = entityRow(list, wanted.label);
    await expect(within(row).getByText(wanted.label)).toBeInTheDocument();

    await userEvent.click(row);
    await expect(args.onAct).toHaveBeenCalledWith({ kind: 'select-entity', id: wanted.id });
  },
};

/**
 * §4.4: "the type rows first, one type unfolded at a time, and a field that appears only for the
 * type that is open." A second type that unfolds while the first stays open makes the rail the
 * whole corpus, which is the state the two steps exist to prevent.
 */
export const OneTypeIsUnfoldedAtATime: Story = {
  render: ({ open, onOpenChange, onAct }) => (
    <RailUnderTest open={open} onOpenChange={onOpenChange} onAct={onAct} />
  ),
  play: async ({ canvasElement, userEvent }) => {
    const second = 'company';
    const canvas = within(canvasElement);

    // The first step: the type rows, and no field at all.
    await expect(canvas.queryByRole('textbox')).not.toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: `Open the ${OPEN_TYPE} list` }));
    await expect(canvas.getAllByRole('textbox')).toHaveLength(1);
    await expect(
      canvas.getByRole('textbox', { name: `Filter ${OPEN_TYPE} by name` }),
    ).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: `Open the ${second} list` }));

    await expect(canvas.getAllByRole('textbox')).toHaveLength(1);
    await expect(
      canvas.getByRole('textbox', { name: `Filter ${second} by name` }),
    ).toBeInTheDocument();
    const closed = canvas.getByRole('button', { name: `Open the ${OPEN_TYPE} list` });
    await expect(closed).toHaveAttribute('aria-expanded', 'false');
    // A closed row names no region. The list is in the tree for the open type alone, so a name
    // here would send a reader to an element that is not there.
    await expect(closed).not.toHaveAttribute('aria-controls');
  },
};

/**
 * §4.4, the third difference from the map: "The useful head of a list on a graph is the hubs." So
 * the list is in the order of the degree, and a name is reached with the field.
 *
 * The order that counts is the order on the screen, so the figures are read from the rows in the
 * order the rail drew them.
 */
export const TheListIsInTheOrderOfTheDegree: Story = {
  args: { rows: openRows },
  play: async ({ canvasElement }) => {
    const list = openListOf(canvasElement, OPEN_TYPE);
    const figures = within(list).getAllByText(FIGURE);

    await expect(figures.length).toBeGreaterThan(1);

    let previous = Number.POSITIVE_INFINITY;
    let first = Number.POSITIVE_INFINITY;
    let last = Number.POSITIVE_INFINITY;
    for (const figure of figures) {
      const degree = Number(figure.textContent);
      await expect(degree).toBeLessThanOrEqual(previous);
      if (previous === Number.POSITIVE_INFINITY) first = degree;
      previous = degree;
      last = degree;
    }

    // A list of one degree would pass the walk above and prove nothing about the order.
    await expect(first).toBeGreaterThan(last);
  },
};

/**
 * §4.4, the second difference from the map: the list is capped, and **the remainder is on the
 * screen**. A surface that drops evidence in silence is worse than one that says how much it
 * dropped.
 *
 * The head of this file says why the rows are shortened here and not derived: the cap is 60 and
 * the read holds eight entities of this type.
 */
export const TheRemainderIsOnScreen: Story = {
  args: { rows: cappedRows },
  play: async ({ args, canvasElement }) => {
    const shown = openListOfRows(args.rows);
    const list = openListOf(canvasElement, OPEN_TYPE);

    for (const entity of shown.entities) {
      await expect(within(list).getByText(entity.label)).toBeInTheDocument();
    }

    await expect(within(list).getByText(`${shown.remainder} more. Use the field.`)).toBeVisible();
  },
};

/**
 * §4.4, the first difference from the map: no colour beside a type. On the map the hue **is** the
 * encoding. Here the hue is the community (§4.2), so a type colour would state an encoding this
 * canvas does not use, and the count carries the weight instead.
 *
 * **A colour is the interior, and no story reads one.** The head of this file says what this
 * assertion can and cannot hold: the row carries the type, the count and the word, and nothing
 * else. A swatch would be a fourth thing in the row.
 */
export const NoTypeCarriesAColour: Story = {
  play: async ({ args, canvasElement }) => {
    for (const row of args.rows.types) {
      const control = typeSwitch(canvasElement, row.type);
      await expect(control.textContent).toBe(`${row.type}${row.count}${wordFor(row.on)}`);
    }
  },
};

/**
 * §5.2, third rule: "A control that can exclude everything carries the way back. The prototype
 * reached an all-grey screen that survived a reload."
 *
 * The screen survived the reload because the filter is stored, so a sentence alone is not the way
 * back. The way back is a control, which reaches the keyboard and the reader, and the set it
 * reports is the stored default of `./workspace` and is never invented by the rail.
 */
export const AControlThatExcludesEverythingCarriesTheWayBack: Story = {
  args: { rows: everyTypeOffRows },
  play: async ({ args, canvasElement, userEvent }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText('Every type is off. The whole graph is dimmed.')).toBeVisible();

    const back = canvas.getByRole('button', { name: 'Switch every type on' });
    await expect(back).toBeEnabled();

    await userEvent.click(back);
    await expect(args.onAct).toHaveBeenCalledWith({
      kind: 'hide-types',
      hiddenTypes: DEFAULT_GRAPH_WORKSPACE.hiddenTypes,
    });
  },
};

/**
 * The folded strip still says what is drawn — §4.4 of the map, which this control shares.
 *
 * There is no type colour on this surface, so the strip carries the initial and the count, and
 * each switch stays reachable: a rail that is folded to save the canvas must not hide the state of
 * the filter. The type is on the control under `aria-label` and under `title`, because one letter
 * names nothing on its own.
 *
 * **The accessible name carries the state as well**, because the strip has room for one letter and
 * §4.4 asks the row to say that a type is off. So the name is `<type>, on` or
 * `<type>, off and dimmed`, and the story reads the name and never a class.
 *
 * **The rows carry a type that is off**, because a strip that is read with every type on proves
 * one half of the name and leaves the other half — the half §5.2 makes easy to write backwards —
 * unproved. The count beside it does not change, because §5.2 dims and never hides, so the name is
 * the one thing that says the state.
 */
export const TheFoldedRailStillSaysWhatIsDrawn: Story = {
  args: { open: false, rows: oneTypeOffRows },
  play: async ({ args, canvasElement }) => {
    await expect(
      within(canvasElement).getByRole('button', { name: 'Open the layer rail' }),
    ).toHaveAttribute('aria-expanded', 'false');

    // The strip is read in both states, so neither name can pass on the other's rows.
    await expect(args.rows.types.filter((row) => row.on).length).toBeGreaterThan(0);
    await expect(args.rows.types.filter((row) => !row.on).length).toBeGreaterThan(0);

    for (const row of args.rows.types) {
      const control = typeSwitch(canvasElement, row.type);
      await expect(control).toHaveAccessibleName(foldedNameFor(row.type, row.on));
      await expect(control).toHaveAttribute('aria-pressed', String(row.on));
      await expect(control.textContent).toBe(`${row.initial}${countOf(row.type)}`);
    }
  },
};
