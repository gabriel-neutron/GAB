import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent, within } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';

import { readDossier, type Dossier, type SourceCardModel } from './dossier';
import { Sidebar } from './sidebar';

/**
 * The check of step 6 of `docs/detail-surface.md` §8, and the three "Must" clauses of §4.5:
 * the sidebar carries no rail, it shows the name and the type and nothing else at the top, and
 * it knows nothing about its neighbour.
 *
 * **Two criteria no story can reach.** "The two panes scroll independently" (§8 step 5) and "a
 * badge scrolls the rail alone" (§8 step 4) both need the whole page on the screen, and
 * `eslint.config.ts` refuses a `-page` import from every `.stories.tsx` file. The `visual-qa`
 * agent proves both on `/entity/:id` in the running application. The other half of step 6 —
 * "the map route and the graph route compose it with no change to either feature" — is proved
 * by the `boundaries` policy of `eslint.config.ts`, which makes an import from one feature to
 * another fail `pnpm check`. **It is not proved by a diff**: a working tree carries the work of
 * other tickets on those two folders, so an empty diff was never the evidence it claimed to be.
 *
 * The input is `readDossier(corpus, …)`, which is what the route calls, so this file changes on
 * the day `src/contract/` replaces the fixtures. **Nothing here is invented.**
 */

/** MV Northern Ledger. Three claims, and its documents are `doc_9b0417`, `manual` and one more. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const read = (): Dossier => {
  const held = readDossier(corpus, VESSEL);
  if (held === null) throw new Error('The committed corpus holds no MV Northern Ledger');
  return held;
};

const DOSSIER = read();

const firstCard = (): SourceCardModel => {
  const held = DOSSIER.sources[0];
  if (held === undefined) throw new Error('The committed corpus cites no document on this entity');
  return held;
};

/** Source 1 of the page order of §4.4. Its mark sits on the first claim that cites it. */
const CARD = firstCard();

/**
 * The accessible name `./dossier` writes for a mark: `Source <n> — <title>`. It carries no
 * score, which `mark.stories.tsx` proves; this file only needs it to find the badge.
 */
const MARK_NAME = `Source ${CARD.number} — ${CARD.title}`;

const WAY_OUT = 'Open the full page at this source, in a new tab';

/** The first badge of that source. Several claims may cite one document. */
const aMark = (root: HTMLElement): HTMLElement => {
  const found = within(root).getAllByRole('button', { name: MARK_NAME })[0];
  if (found === undefined) throw new Error('No mark carries the name of source 1');
  return found;
};

/**
 * The popover is portalled to the body, so a scrolling ancestor cannot clip it. It is therefore
 * outside `canvasElement`, and `screen` is what reaches it.
 */
const openPopover = async (root: HTMLElement): Promise<HTMLElement> => {
  await userEvent.click(aMark(root));
  return screen.findByRole('dialog');
};

const meta = {
  component: Sidebar,
  args: { dossier: DOSSIER },
  parameters: { layout: 'fullscreen' },
  // §4.5 makes 24 rem part of the contract, and the sidebar carries that width itself. The row
  // below states a height, exactly as the route does, and the sidebar stretches to it. Without a
  // stated height on the row its `overflow-y-auto` is not a scroll at all.
  render: (args) => (
    <div className="flex h-[600px]">
      <Sidebar {...args} />
    </div>
  ),
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * §4.5: "Must show the name and the type, and nothing else at the top." No identifier and no
 * coordinate: the analyst arrived from the map or from the graph.
 */
export const TheTopShowsTheNameAndTheTypeOnly: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1 });
    await expect(heading).toHaveTextContent(DOSSIER.label);
    await expect(heading).toHaveTextContent(DOSSIER.type);

    await expect(canvas.queryByText(DOSSIER.entityId)).toBeNull();
    // The geometry of this entity in the committed corpus. A coordinate belongs to the map.
    await expect(canvas.queryByText(/4\.4777|51\.9244/)).toBeNull();
  },
};

/** §4.5: "Must carry no rail." There is no room for one, and the popover replaces it. */
export const TheSidebarCarriesNoRail: Story = {
  play: async ({ canvas }) => {
    const sidebar = canvas.getByRole('complementary', { name: DOSSIER.label });
    await expect(within(sidebar).queryByRole('complementary', { name: 'Sources' })).toBeNull();
  },
};

/** §4.5: a badge opens the source in a popover, and the popover carries the same card. */
export const ABadgeOpensTheSourceInAPopover: Story = {
  play: async ({ canvasElement }) => {
    const popover = await openPopover(canvasElement);
    await expect(popover).toHaveTextContent(CARD.title);
  },
};

/**
 * §4.5: the popover carries one way out — the full page, in a new tab, opened at that source.
 * §6: `?src=` is kept and `?surface=` is scaffolding that the rebuild leaves behind.
 */
export const ThePopoverCarriesOneWayOut: Story = {
  play: async ({ canvasElement }) => {
    const popover = await openPopover(canvasElement);
    const link = within(popover).getByRole('link', { name: WAY_OUT });

    await expect(link).toHaveAttribute('href', `/entity/${DOSSIER.entityId}?src=${CARD.id}`);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link.getAttribute('href') ?? '').not.toContain('surface=');
  },
};

/**
 * §4.5: "The same record, the same groups, one claim to a line." §4.1 states that one layout
 * serves both surfaces, so the sidebar states no width of its own inside the record.
 *
 * **`document.fonts.ready` is awaited first.** The theme declares `Roboto Condensed` and
 * `JetBrains Mono`. The day either one is installed, the text reflows after a measurement that
 * did not wait, and the story flakes.
 */
export const TheSameRecordIsDrawnOneClaimToALine: Story = {
  play: async ({ canvasElement }) => {
    await document.fonts.ready;

    const cells = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-claim]'));
    await expect(cells).toHaveLength(DOSSIER.claimCount);

    const tops = new Set<number>();
    for (const cell of cells) {
      tops.add(cell.offsetTop);
    }

    await expect(tops.size).toBe(DOSSIER.claimCount);
  },
};
