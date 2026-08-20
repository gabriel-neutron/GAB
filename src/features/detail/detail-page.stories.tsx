import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';

import { DetailPage } from './detail-page';
import { readDossier, type Dossier, type SourceCardModel } from './dossier';

/**
 * The full page: the record on the left, the sources on the right.
 *
 * The labelling notice, the sources of the entity itself and the promotion trail all sit on this
 * surface. M8 asks for the second one: `src` is never empty. **Those three are drawn by this file
 * and by no child**, so no other story reaches them.
 *
 * The seam this file proves is `activeSource`: a click on a mark in the left pane names a
 * document, and the rail marks that card. `rail.stories.tsx` proves that the rail moves when the
 * active source changes; this file proves that a mark in the record is what changes it.
 *
 * The input is `readDossier(corpus, …)`, which is what the route calls, so this file changes on
 * the day `src/contract/` replaces the fixtures. **Nothing here is invented.**
 *
 * **This file exists because a lint gate moved.** `eslint.config.ts` refused every `*-page`
 * import from every story, for a hazard that belongs to the two pages that mount a live canvas.
 * The group now names those two by name. This page mounts none, and it reaches neither MapLibre
 * nor Sigma through any import.
 *
 * ## What no story of this file can reach
 *
 * **The populated scroll.** "The two panes scroll independently" needs a pane whose content is
 * taller than the pane. The committed corpus gives MV Northern Ledger three claims and a few
 * documents, and the shell takes the height of its parent, so neither pane overflows and a
 * `scrollTop` assertion would pass while proving nothing.
 * `EachPaneIsItsOwnScrollContainer` proves the half this component owns — two separate scroll
 * containers, and neither inside the other — which is the structure that makes the independent
 * scroll possible. The scroll itself needs a density probe, and the tracker carries it. Until
 * then the `visual-qa` agent proves it on `/entity/:id` in the running application.
 */

/** MV Northern Ledger. It carries claims, relations and cited documents. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const read = (): Dossier => {
  const held = readDossier(corpus, VESSEL);
  if (held === null) throw new Error('The committed corpus holds no MV Northern Ledger');
  return held;
};

const DOSSIER = read();

const firstCard = (): SourceCardModel => {
  const held = DOSSIER.sources[0];
  if (held === undefined) throw new Error('The dossier carries no card');
  return held;
};

const CARD = firstCard();

/** The accessible name `./dossier` writes for a page mark: `Source <n> — <title>`. */
const MARK_NAME = `Source ${CARD.number} — ${CARD.title}`;

/** The rail. It names itself, so the story reads the contract and not a class. */
const railOf = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('complementary', { name: 'Sources' });

/** The pane that holds the record. It is the scrolling ancestor of a claim cell. */
const recordPaneOf = (root: HTMLElement): HTMLElement => {
  const claim = root.querySelector<HTMLElement>('[data-claim]');
  if (claim === null) throw new Error('The record draws no claim');
  const pane = claim.closest<HTMLElement>('.overflow-y-auto');
  if (pane === null) throw new Error('The record sits in no scrolling pane');
  return pane;
};

const meta = {
  component: DetailPage,
  args: { dossier: DOSSIER, arrivedAtSource: null },
  // The page states its own height, from the viewport. It is the whole surface, so it takes the
  // whole frame and the story adds no wrapper that would fight that height.
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DetailPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * "Each pane scrolls on its own, and neither drives the other except through a badge." Two
 * scroll containers, and neither one inside the other, is what makes that true. A single
 * container, or a rail nested in the record pane, would move both together and no assertion on
 * the words could see it.
 */
export const EachPaneIsItsOwnScrollContainer: Story = {
  play: async ({ canvasElement }) => {
    const rail = railOf(canvasElement);
    const record = recordPaneOf(canvasElement);

    await expect(record).not.toBe(rail);
    await expect(record.contains(rail)).toBe(false);
    await expect(rail.contains(record)).toBe(false);

    // Each one carries its own scroll, and the window carries neither.
    await expect(getComputedStyle(rail).overflowY).toBe('auto');
    await expect(getComputedStyle(record).overflowY).toBe('auto');
  },
};

/**
 * A click on a mark in the record marks the card in the rail. **This is the seam the page owns**
 * — `activeSource` — and no child story can reach it: the record holds the mark, the rail
 * holds the card, and only this file joins the two.
 */
export const AMarkInTheRecordMarksTheCardInTheRail: Story = {
  play: async ({ canvasElement }) => {
    const rail = railOf(canvasElement);

    // No card is marked before a click. `arrivedAtSource` is the normal arrival, which is null.
    await expect(rail.querySelector('[aria-current="true"]')).toBeNull();

    const first = within(canvasElement).getAllByRole('button', { name: MARK_NAME })[0];
    if (first === undefined) throw new Error('No mark carries the name of source 1');
    await userEvent.click(first);

    await expect(rail.querySelector('[aria-current="true"]')).toHaveTextContent(CARD.title);
    await expect(first).toHaveAttribute('aria-pressed', 'true');
  },
};

/**
 * Arriving with a source named opens the page at that card. `?src=` reaches this component as
 * `arrivedAtSource`, which the route reads once and the page never writes back.
 */
export const ArrivingWithASourceMarksThatCard: Story = {
  args: { arrivedAtSource: CARD.id },
  play: async ({ canvasElement }) => {
    const marked = railOf(canvasElement).querySelector('[aria-current="true"]');
    await expect(marked).toHaveTextContent(CARD.title);
  },
};

/**
 * Two paragraphs of placeholder words were removed: the labelling notice that stood in for the
 * real disclaimer, and the promotion trail that named a proposal identifier to the reader.
 *
 * **This story proves they do not come back.** The tracker carries the real disclaimer, and PU1
 * requires it: everything is public, the candidate layer included. A placeholder that reads like
 * a disclaimer is worse than none.
 */
export const NoPlaceholderProseIsDrawn: Story = {
  play: async ({ canvasElement }) => {
    const words = canvasElement.textContent;
    await expect(words).not.toMatch(/Placeholder words/);
    await expect(words).not.toMatch(/Promoted by proposal/);
  },
};

/**
 * M8: the entity names the documents it comes from, and no control hides them. The row carries
 * the same mark the claims carry, so one control answers "where did this come from" everywhere on
 * the surface.
 */
export const TheEntityNamesItsOwnSources: Story = {
  play: async ({ canvas }) => {
    const row = canvas.getByText('Sources of this entity').parentElement;
    if (row === null) throw new Error('The row of the entity sources has no element');

    await expect(DOSSIER.entitySources.length).toBeGreaterThan(0);
    for (const source of DOSSIER.entitySources) {
      await expect(within(row).getByRole('button', { name: source.name })).toBeVisible();
    }
  },
};
