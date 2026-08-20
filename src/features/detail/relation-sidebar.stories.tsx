import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, within } from 'storybook/test';

import { relationLines } from '@/shared/canvas-label';
import { corpus } from '@/shared/fixtures/corpus';

import { readRelation, type RelationDossier } from './dossier';
import { RelationSidebar } from './sidebar';

/**
 * The check of #89 DETAIL-RELATION-VIEW. The component lives in `./sidebar.tsx`, which draws the
 * two things a canvas can select in one pane; this file checks the relation half of it.
 *
 * The operator asked for a view simpler than an entity view: **the entity at each end, the type,
 * and the sources**. Each story below names one of those clauses, or the rule that #89 gave the
 * words: the direction is the one both canvases already draw.
 *
 * **One criterion no story can reach.** "A click on a line opens this panel" needs a live canvas,
 * and `CANVAS.md` gives no story one. The `visual-qa` agent proves it on `/map` and on `/graph`
 * in the running application.
 *
 * The input is `readRelation(corpus, …)`, which is what both routes call, so this file changes on
 * the day `src/contract/` replaces the fixtures. **Nothing here is invented.**
 */

/** MV Northern Ledger, berthed at a terminal. One document, and no interval at all. */
const BERTHED_ID = 'c3d4e5f6-9a0b-4123-c456-d7e8f90a1b2c';

/** An ownership that ended. M6 gives it both ends, and a reader must not take it for current. */
const CLOSED_ID = 'a10b2c3d-1111-4a11-9c33-000000000002';

const read = (id: string): RelationDossier => {
  const held = readRelation(corpus, id);
  if (held === null) throw new Error(`The committed corpus holds no relation ${id}`);
  return held;
};

const BERTHED = read(BERTHED_ID);
const CLOSED = read(CLOSED_ID);

/** The two ends and the type of `BERTHED`, as the committed corpus states them. */
const FROM = 'MV Northern Ledger';
const TO = 'Maasvlakte bulk terminal, berth 7';

/** The type as the read carries it, and the type as every surface now says it — #89 Q4. */
const RAW_TYPE = 'berthed_at';
const TYPE = 'berthed at';

/** The one document of `BERTHED`, and the count control that opens it. */
const CARD_TITLE = 'Vessel movement log, scanned';
const ONE_SOURCE = '1 source document. Open it.';

/** The way out of the entity panel. A relation has no full page, so no popover here carries it. */
const WAY_OUT = 'Open the full page at this source, in a new tab';

/**
 * The popover is portalled to the body, so a scrolling ancestor cannot clip it. It is therefore
 * outside `canvasElement`, and `screen` is what reaches it.
 */
const openPopover = async (root: HTMLElement): Promise<HTMLElement> => {
  await userEvent.click(within(root).getByRole('button', { name: ONE_SOURCE }));
  return screen.findByRole('dialog');
};

const meta = {
  component: RelationSidebar,
  args: { relation: BERTHED },
  parameters: { layout: 'fullscreen' },
  // §4.5 makes 24 rem part of the contract, and the panel carries that width itself. The row
  // below states a height, exactly as the route does, and the panel stretches to it.
  render: (args) => (
    <div className="flex h-[600px]">
      <RelationSidebar {...args} />
    </div>
  ),
} satisfies Meta<typeof RelationSidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** #89: the entity at each end, and the type. Three lines, and one of them is each. */
export const TheTwoEndsAndTheTypeAreDrawn: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1 });
    await expect(heading).toHaveTextContent(FROM);
    await expect(heading).toHaveTextContent(TYPE);
    await expect(heading).toHaveTextContent(TO);
  },
};

/**
 * #89: the panel writes no second wording for the direction. The three lines are the three that
 * `shared/canvas-label.ts` gives both canvases, in that order, so a hover over the line and the
 * panel beside it can never disagree about which way the relation points.
 */
export const TheDirectionIsTheOneBothCanvasesDraw: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1 });
    // The raw identifier goes into the shared function, exactly as each canvas passes it.
    await expect(heading).toHaveTextContent(relationLines(FROM, RAW_TYPE, TO).join(''));
  },
};

/**
 * The operator ruled on #89 that one relation carries one name on every surface, and that the
 * name is words. **The identifier reaches no screen.** `shared/canvas-label.ts` holds the rule,
 * so the two canvases changed with this panel.
 */
export const TheTypeReadsInWordsAndNeverAsTheIdentifier: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1 });
    await expect(heading).toHaveTextContent(TYPE);
    await expect(canvas.queryByText(new RegExp(RAW_TYPE))).toBeNull();
  },
};

/**
 * The heading carries the arrow, and the accessible name carries the words. An arrow is a picture
 * of the direction, and a reader who is given the lines hears "down arrow" instead of a relation.
 */
export const TheNameOfThePanelSaysTheDirectionInWords: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1, name: `${FROM} ${TYPE} ${TO}` });
    await expect(heading).toBeInTheDocument();
    await expect(
      canvas.getByRole('complementary', { name: `${FROM} ${TYPE} ${TO}` }),
    ).toBeVisible();
  },
};

/**
 * #89: the sources. The presentation is the one the entity panel already uses — one control that
 * counts the documents, and one popover that opens the same card.
 */
export const TheSourcesOpenTheSameCardTheEntityPanelOpens: Story = {
  play: async ({ canvasElement }) => {
    const popover = await openPopover(canvasElement);
    await expect(popover).toHaveTextContent(CARD_TITLE);
  },
};

/**
 * A relation has no full page, so the popover carries no way out. A link to the page of an
 * endpoint would open a rail that need not hold this card, and a reader would take that absence
 * for a lost source.
 */
export const ThePopoverOfARelationCarriesNoWayOut: Story = {
  play: async ({ canvasElement }) => {
    const popover = await openPopover(canvasElement);
    await expect(within(popover).queryByRole('link', { name: WAY_OUT })).toBeNull();
  },
};

/**
 * M9: the unknown is a blank cell under a header that names the key. This relation carries no
 * interval, and the row stays on the screen so that the absence never reads as a fault.
 */
export const ARelationWithNoIntervalDrawsABlankUnderTheKey: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Validity')).toBeVisible();
    await expect(canvas.queryByText(/closed|no end date|no start date/)).toBeNull();
  },
};

/** M6: an interval is written at both ends, and a closed one says that it is closed. */
export const AClosedIntervalSaysThatItIsClosed: Story = {
  args: { relation: CLOSED },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('from 2018-02-01 to 2025-09-30, and closed')).toBeVisible();
  },
};
