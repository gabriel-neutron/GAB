import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent, within } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';

import { DetailPage } from './detail-page';
import { readDossier, type Dossier, type SourceCardModel } from './dossier';

// A lint gate refuses a page story that mounts a live canvas. This page mounts none.
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

const MARK_NAME = `Source ${CARD.number} — ${CARD.title}`;

const railOf = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('complementary', { name: 'Sources' });

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
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DetailPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const EachPaneIsItsOwnScrollContainer: Story = {
  play: async ({ canvasElement }) => {
    const rail = railOf(canvasElement);
    const record = recordPaneOf(canvasElement);

    await expect(record).not.toBe(rail);
    await expect(record.contains(rail)).toBe(false);
    await expect(rail.contains(record)).toBe(false);

    await expect(getComputedStyle(rail).overflowY).toBe('auto');
    await expect(getComputedStyle(record).overflowY).toBe('auto');
  },
};

export const AMarkInTheRecordMarksTheCardInTheRail: Story = {
  play: async ({ canvasElement }) => {
    const rail = railOf(canvasElement);

    await expect(rail.querySelector('[aria-current="true"]')).toBeNull();

    const first = within(canvasElement).getAllByRole('button', { name: MARK_NAME })[0];
    if (first === undefined) throw new Error('No mark carries the name of source 1');
    await userEvent.click(first);

    await expect(rail.querySelector('[aria-current="true"]')).toHaveTextContent(CARD.title);
    await expect(first).toHaveAttribute('aria-pressed', 'true');
  },
};

export const ArrivingWithASourceMarksThatCard: Story = {
  args: { arrivedAtSource: CARD.id },
  play: async ({ canvasElement }) => {
    const marked = railOf(canvasElement).querySelector('[aria-current="true"]');
    await expect(marked).toHaveTextContent(CARD.title);
  },
};

export const NoPlaceholderProseIsDrawn: Story = {
  play: async ({ canvasElement }) => {
    const words = canvasElement.textContent;
    await expect(words).not.toMatch(/Placeholder words/);
    await expect(words).not.toMatch(/Promoted by proposal/);
  },
};

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
