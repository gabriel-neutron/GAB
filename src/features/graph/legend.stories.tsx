import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, within } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import type { Entity } from '@/shared/fixtures/types';
import { cn } from '@/shared/lib/utils';

import { Legend, type FilterReach, type LegendReading, type MarkerReach } from './legend';
import { buildGraphModel, GRAPH_PALETTES, type NodePosition } from './model';

/**
 * The states of the legend of the graph.
 *
 * Built from `docs/graph-surface.md` §4.5 (the component), §3.3, §5.2, §5.5, and the *Check* of
 * §8 steps 2, 6 and 7. Each export below is named for the criterion it proves.
 *
 * **The read comes from the same module the caller reads.** `@/shared/fixtures/corpus` is
 * provisional, and the day `src/contract/` replaces it the caller and this file change together.
 *
 * **No story mounts a live canvas.** `CANVAS.md` holds the reason. The legend is a sibling of the
 * canvas, so it is storied alone. Everything below is asserted **through the panel**: a role, an
 * accessible name, `aria-expanded`, `aria-controls`, the text, or a `title` the component states
 * as part of its contract. A class name and a colour are the interior of the component, and no
 * story reads one.
 *
 * **The four read values arrive as one shape.** `LegendReading` carries the definitions, the
 * counts, the reach of the filter and the marker counts, so a story that changes one of the four
 * states the whole reading — `readingOf` below does that, and no story patches a prop that the
 * seam no longer has.
 *
 * ## What no story of this file can reach
 *
 * - **"The same corpus gives the same communities", §8 step 1 clause a, and §4.1.** The panel of
 *   §4.5 no longer carries the count of communities, of isolates or of cut points: those are
 *   build diagnostics, and §4.5 asks the panel for what the paint means and for how much is out
 *   of consideration. So a story of this panel cannot compare two builds any more. The story
 *   `TheSameCorpusGivesTheSameCommunities` is deleted for that reason, and it is **not** weakened
 *   into passing on fewer rows. What proves it instead: the counts stay on `GraphModel` as named
 *   fields, and the walk in insertion order with a tie on the lowest label, which `structure.ts`
 *   records in its comments. A check of that model belongs to a level of the test policy that
 *   **#21** leaves open.
 * - **"The count of bridges is far below the count of cut points", §8 step 1 clause b, and
 *   §3.4.** Both terms left the panel with the diagnostics. The story
 *   `BridgesAreFarBelowCutPoints` is deleted for that reason. It proved little in any case: the
 *   27 entities of the fixture give 5 cut points and 0 bridges, because the floor of §3.4 is 6 at
 *   that order, and §6 removed the inflater that grew the fixture to 10 000 entities. What proves
 *   it instead: `structure.bridges` and `structure.cutPoints` on the model, and §3.4 itself.
 * - **"No colour is black", §8 step 2 clause b and §4.2.** A colour is the interior, so it must
 *   not be read from the DOM; and a `play` that reads the value out of `model.ts` instead is a
 *   unit test wearing a story, which **#21** leaves open and to the operator. What proves it: the
 *   conversion of each token of `src/index.css` to `#rrggbb`, recorded line by line in
 *   `GRAPH_PALETTES` of `model.ts`, and a look at the running canvas, which `CANVAS.md` sends to
 *   the `visual-qa` agent.
 * - **Which token a swatch wears, §4.5.** The swatch is a Tailwind class, and a class is the
 *   interior: the skill forbids a story that reads one. What proves it instead: `LegendToken` is
 *   a closed set of four in `model.ts`, the `SWATCH` record of `legend.tsx` writes each class out
 *   whole so that Tailwind can see it, and `src/index.css` declares each of the four tokens. A
 *   line with no hue carries `token: null` and therefore no swatch at all.
 * - **"The M4 relation is absent from the edges", §8 step 2 clause a.** The edge set is the
 *   interior of `model.ts`. The panel carries one figure, and that figure would read the same if
 *   `buildGraphModel` drew every M4 relation **and** counted it. What proves it: the read of
 *   `m4RelationsByEndpoint` on the detail surface of UC3, and the canvas, where an edge that must
 *   not exist is visible.
 * - **"Held under every endpoint it names", §4.2.** The same index, and the same reason. UC3 on
 *   the detail surface is what will exercise it.
 * - **Which 250 elements carry a marker, §3.3 and #10.** The cap and the order are the interior
 *   of the `controller` of §4.3, and this panel is given two figures. The story below proves the
 *   half that the panel owns: the remainder is stated in words.
 * - **A contrast ratio on either ground.** A colour is the interior. `src/index.css` holds the
 *   measured ladder, and `model.ts` records each ratio against `--background`.
 */

/**
 * Where each node is drawn, for this file only.
 *
 * **This is not a guess about #35.** `layout.ts` is the stand-in the operator decided, and it is
 * the one place that guesses at a placement. No position reaches this panel: the legend draws an
 * encoding, three reports and two pairs of figures. So the story needs a map of the right shape
 * and nothing more, and it builds no topology to obtain one.
 */
const positionsOf = (entities: readonly Entity[]): ReadonlyMap<string, NodePosition> =>
  new Map(entities.map((entity, index) => [entity.id, { x: index, y: index }]));

const positions = positionsOf(corpus.entities);

/** The model the panel draws. §4.3 gives the ground to the controller, so the story states it. */
const lightModel = buildGraphModel(corpus, positions, GRAPH_PALETTES.light);
const darkModel = buildGraphModel(corpus, positions, GRAPH_PALETTES.dark);

/** The figure of a row is the only pure number in it, so the row tells the two spans apart. */
const FIGURE = /^\d+$/;

/** The row of one count, found by the text of its label. */
const rowOf = (root: HTMLElement, label: string): HTMLElement => {
  const row = within(root).getByText(label).closest('li');
  if (row === null) throw new Error(`The legend draws no row for "${label}".`);
  return row;
};

/** The line of one sentence, found by the words it states. */
const lineOf = (root: HTMLElement, words: string): HTMLElement => {
  const line = within(root).getByText(words).closest('p');
  if (line === null) throw new Error(`The legend draws no line for "${words}".`);
  return line;
};

/** What the panel reports for one count. */
const figureOf = (root: HTMLElement, label: string): number =>
  Number(within(rowOf(root, label)).getByText(FIGURE).textContent);

/**
 * The region the fold control names while the definitions are in the tree.
 *
 * The identifier is part of the contract of the control, so the story states it and never reads
 * it back out of the component. `legend.tsx` holds the same constant, and it exports none.
 */
const DEFINITIONS_ID = 'graph-legend-definitions';

/** The fold control of the panel. Its name states which act it makes. */
const foldControl = (root: HTMLElement, name: string): HTMLElement =>
  within(root).getByRole('button', { name });

/** The element the fold control names with `aria-controls`, read from the tree of the story. */
const namedRegionOf = (root: HTMLElement, control: HTMLElement): HTMLElement => {
  const id = control.getAttribute('aria-controls');
  const region = id === null ? null : root.querySelector(`#${id}`);
  if (!(region instanceof HTMLElement)) throw new Error(`The legend holds no region for "${id}".`);
  return region;
};

const M4_IN_THE_INDEX = 'M4 relations, in the index and not on the canvas';
const PENDING_WITH_NO_ELEMENT = 'Pending proposals with no element';

/** What the controller publishes with no filter on: everything is lit, and nothing is dimmed. */
const WHOLE_PICTURE: FilterReach = { lit: lightModel.entitiesDrawn, dimmed: 0 };

/**
 * The marker counts where the cap of §3.3 did not bite.
 *
 * The read carries three pending proposals and one of them names an element that the graph draws,
 * so one element can carry a marker and none is over the cap — §3.3.
 */
const EVERY_MARKER_DRAWN: MarkerReach = { drawn: lightModel.pendingByTarget.size, overCap: 0 };

/**
 * The marker counts where the cap **did** bite.
 *
 * The cap is 250 and it belongs to the `controller` of §4.3. The read holds 27 entities, so no
 * derivation from the fixture reaches that state; the panel draws the two figures it is given, and
 * the figures are stated here. §8 step 7 asks the surface for the remainder, and this is the
 * reading that has one.
 */
const CAP_BIT: MarkerReach = { drawn: 250, overCap: 37 };

/** Everything the panel states, for the light ground. */
const READING: LegendReading = {
  definitions: lightModel.legendDefinitions,
  counts: lightModel.legendCounts,
  reach: WHOLE_PICTURE,
  markers: EVERY_MARKER_DRAWN,
};

/** One reading with one part changed. The four values travel together, so they change together. */
const readingOf = (patch: Partial<LegendReading>): LegendReading => ({ ...READING, ...patch });

const meta = {
  component: Legend,

  // §4.5 puts the legend at the bottom right of the canvas, and the layout of a story is
  // `centered`. The width is part of the contract: the panel is `w-64`, which is 16 rem, so the
  // frame states that width and the truncation of a label is the truncation of the real surface.
  decorators: [
    (Story) => (
      <div className={cn('w-64')}>
        <Story />
      </div>
    ),
  ],

  args: {
    reading: READING,
    open: false,
    onOpenChange: fn(),
  },
} satisfies Meta<typeof Legend>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * §8 step 6 *Check*, word for word: "the counts stay visible when the definitions are folded
 * away". A definition that is hidden with a class stays reachable to a reader and to the
 * keyboard, so the story asserts that each definition has **left the tree**.
 *
 * **A folded control names no region.** The list of definitions leaves the tree with the
 * definitions, so a fold control that still carried `aria-controls` sent a reader to an element
 * that is not there. `./rail` states the same rule on the chevron of a type row.
 */
export const CountsStayVisibleWhenFolded: Story = {
  args: { open: false },
  play: async ({ args, canvasElement }) => {
    for (const count of args.reading.counts) {
      const row = rowOf(canvasElement, count.label);
      await expect(within(row).getByText(String(count.count))).toBeInTheDocument();
    }

    for (const definition of args.reading.definitions) {
      await expect(within(canvasElement).queryByText(definition.meaning)).not.toBeInTheDocument();
    }

    const control = foldControl(canvasElement, 'Show what the paint means');
    await expect(control).toHaveAttribute('aria-expanded', 'false');
    await expect(control).not.toHaveAttribute('aria-controls');
    await expect(canvasElement.querySelector(`#${DEFINITIONS_ID}`)).toBeNull();
  },
};

/**
 * §4.5: "States … how much of the picture is out of consideration." §5.2 makes a filter dim and
 * never hide, so the pair is the whole picture. The line is drawn for each value of `open`, and
 * the folded state is the one that could lose it, so the folded state is what is asserted.
 */
export const HowMuchIsDimmedIsStatedWhenFolded: Story = {
  args: { open: false, reading: readingOf({ reach: { lit: 12, dimmed: 15 } }) },
  play: async ({ canvasElement }) => {
    const line = lineOf(canvasElement, 'lit');

    await expect(within(line).getByText('12')).toBeInTheDocument();
    await expect(within(line).getByText('15')).toBeInTheDocument();
  },
};

/**
 * §4.5: "The definitions fold away." A definition is a short label, so it is read by its text.
 * The header states the fold with `aria-expanded`, which a reader hears, and the workspace holds
 * the value (ADR 0004 §7), so the panel reports the change and never keeps it.
 *
 * **The open control names the region that holds the definitions**, and that region is in the
 * tree. A name that pointed at nothing was invisible to a story which read `aria-expanded` alone,
 * so the region is read back out of the tree here by the identifier the control gives.
 */
export const DefinitionsUnfold: Story = {
  args: { open: true, onOpenChange: fn() },
  play: async ({ args, canvasElement, userEvent }) => {
    for (const definition of args.reading.definitions) {
      await expect(within(canvasElement).getByText(definition.meaning)).toBeInTheDocument();
    }

    const control = foldControl(canvasElement, 'Hide what the paint means');
    await expect(control).toHaveAttribute('aria-expanded', 'true');
    await expect(control).toHaveAttribute('aria-controls', DEFINITIONS_ID);
    await expect(namedRegionOf(canvasElement, control)).toBeInTheDocument();

    await userEvent.click(control);
    await expect(args.onOpenChange).toHaveBeenCalledWith(false);
  },
};

/**
 * §3.3, and the rule that a surface which drops evidence in silence is worse than one that says
 * how much it dropped. These are the counts of `model.ts`: **a proposal that names no element**.
 * The count of §8 step 7 is a different number, and the two stories below hold it.
 *
 * The fixture carries three pending proposals. `update_attrs` names an entity that the graph
 * draws, so **one can be drawn**. `create_relation` and `create_entity` name nothing that exists,
 * so **two cannot**.
 *
 * The two M4 relations of the fixture are the second report: the index holds them and the canvas
 * does not draw them, which is a report and not a loss. **The figure is all the panel carries.**
 * That the edges hold no M4 relation is the interior of `model.ts`, and the head of this file
 * says what proves it.
 *
 * The third row is the evidence that **#35** is unanswered. `model.ts` draws it at 0, and it is
 * the one count of zero the panel keeps.
 */
export const EveryReportOfDroppedEvidenceIsStated: Story = {
  play: async ({ canvasElement }) => {
    await expect(figureOf(canvasElement, PENDING_WITH_NO_ELEMENT)).toBe(2);
    await expect(figureOf(canvasElement, M4_IN_THE_INDEX)).toBe(2);
    await expect(figureOf(canvasElement, 'Entities with no position')).toBe(0);
  },
};

/**
 * §8 step 7 *Check*, word for word: "the count that cannot be drawn is stated on screen." §3.3 is
 * the finding: a marker drawn as an element of the page has a ceiling, the `controller` of §4.3
 * caps the markers there, and the remainder must reach the analyst.
 *
 * The drawn figure is beside it, because a remainder with no total states nothing. The words are
 * the contract, and the `title` names the same thing in a whole sentence for a truncated label.
 */
export const TheMarkerCountThatCannotBeDrawnIsStated: Story = {
  args: { reading: readingOf({ markers: CAP_BIT }) },
  play: async ({ canvasElement }) => {
    const remainder = within(canvasElement).getByText('pending elements carry no marker');
    await expect(remainder).toHaveAttribute('title', 'Pending elements that carry no marker');
    await expect(
      within(lineOf(canvasElement, 'pending elements carry no marker')).getByText(
        String(CAP_BIT.overCap),
      ),
    ).toBeInTheDocument();

    await expect(
      within(lineOf(canvasElement, 'markers drawn')).getByText(String(CAP_BIT.drawn)),
    ).toBeInTheDocument();
  },
};

/**
 * The other half of §8 step 7, which the surface owes as much: **a loss that did not happen is
 * not stated**. A panel that floats over the canvas draws no row for a remainder of zero, and a
 * sentence about a loss of nothing teaches the analyst to read the sentence as noise. The total
 * stays, because it is what the remainder would be read against.
 */
export const NoLineIsInventedWhereEveryMarkerIsDrawn: Story = {
  args: { reading: readingOf({ markers: EVERY_MARKER_DRAWN }) },
  play: async ({ canvasElement }) => {
    await expect(
      within(lineOf(canvasElement, 'markers drawn')).getByText(String(EVERY_MARKER_DRAWN.drawn)),
    ).toBeInTheDocument();

    await expect(
      within(canvasElement).queryByText('pending elements carry no marker'),
    ).not.toBeInTheDocument();
  },
};

/**
 * There is no theme decorator in `.storybook/preview.ts`: the light theme is on `:root` and the
 * dark theme is behind a `.dark` class, so a story that proves the dark ground sets the class
 * itself. The decorator sets it **before the first paint**, because a class added after the mount
 * proves nothing about the ground the tree rendered on. The `play` removes it, because the class
 * is on `documentElement` and it would otherwise reach the story that runs next.
 *
 * **The paint of the canvas is a palette that the caller passes** — `GRAPH_PALETTES.dark` here —
 * and the model of §4.2 reads no theme. So this story proves the **panel** and never the canvas.
 *
 * **No contrast ratio is asserted**, because a colour is the interior of the component. The
 * measured ladder lives in `src/index.css`, and `model.ts` records each ratio of the palette
 * against `--background`. What this story proves is that the panel still **reads** on the dark
 * ground: the same accessible name on the control, the same definitions, and the same figures.
 */
export const DarkGround: Story = {
  args: {
    reading: readingOf({
      definitions: darkModel.legendDefinitions,
      counts: darkModel.legendCounts,
    }),
    open: true,
  },
  decorators: [
    (Story) => {
      // The class is set during the render of the decorator, so the tree below it mounts under
      // the dark theme. The `play` below removes it.
      document.documentElement.classList.add('dark');
      return <Story />;
    },
  ],
  play: async ({ args, canvasElement }) => {
    try {
      await expect(
        within(canvasElement).getByRole('button', { name: 'Hide what the paint means' }),
      ).toBeInTheDocument();

      for (const count of args.reading.counts) {
        const row = rowOf(canvasElement, count.label);
        await expect(within(row).getByText(String(count.count))).toBeInTheDocument();
      }

      for (const definition of args.reading.definitions) {
        await expect(within(canvasElement).getByText(definition.meaning)).toBeInTheDocument();
      }
    } finally {
      document.documentElement.classList.remove('dark');
    }
  },
};
