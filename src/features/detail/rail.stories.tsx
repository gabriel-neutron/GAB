import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import { vocabulary } from '@/shared/fixtures/vocabulary';
import type { DocId } from '@/shared/read/model';

import { readDossier, type SourceCardModel } from './dossier';
import { Rail } from './rail';

// `eslint.config.ts` refuses an import of a `-page` file from a story. Thus no story here can
// mount the record and the rail on one page.
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const SOURCES: readonly SourceCardModel[] = readDossier(corpus, VESSEL, vocabulary)?.sources ?? [];

// The density needs fourteen documents, and the committed corpus cites fewer. These rows are
// invented for this story only. No other file reads them.
const REPEATED: readonly SourceCardModel[] = Array.from({ length: 14 }, (_, index) => {
  const base = SOURCES[index % SOURCES.length];
  if (base === undefined) throw new Error('The committed corpus cites no document on this entity');
  return { ...base, id: `${base.id}-${index + 1}`, number: index + 1 };
});

const at = (index: number): SourceCardModel => {
  const held = REPEATED[index];
  if (held === undefined) throw new Error('The repeated fixture is shorter than it states');
  return held;
};

const FIRST = at(0);
const LAST = at(REPEATED.length - 1);

const MOVE = 'Move the mark to the last source';

// `document.fonts.ready` is awaited before every geometry read. The declared fonts are not
// installed yet. If a font package lands, each card reflows and each measurement flakes.
const markedCard = (rail: HTMLElement): HTMLElement => {
  const found = rail.querySelector<HTMLElement>('[aria-current="true"]');
  if (found === null) throw new Error('No card carries `aria-current`');
  return found;
};

// The button stands in for the badge of the record, which no story can mount.
function RailUnderAMovingMark() {
  const [activeSource, setActiveSource] = useState<DocId>(FIRST.id);

  return (
    <div className="flex h-40 w-96 flex-col">
      <button
        type="button"
        onClick={() => {
          setActiveSource(LAST.id);
        }}
      >
        {MOVE}
      </button>
      <div className="min-h-0 flex-1">
        <Rail sources={REPEATED} activeSource={activeSource} />
      </div>
    </div>
  );
}

const meta = {
  component: Rail,
  args: { sources: SOURCES, activeSource: null },
  parameters: { layout: 'fullscreen' },
  // The rail is a 24 rem pane that holds its own scroll, so every story states
  // a width and a height. Without a stated height the scroll is not real and nothing is proved.
  render: (args) => (
    <div className="h-40 w-96">
      <Rail {...args} />
    </div>
  ),
} satisfies Meta<typeof Rail>;

export default meta;

type Story = StoryObj<typeof meta>;

// The height below is one 900 px screen.
export const FourteenDocumentsFitOneScreen: Story = {
  args: { sources: REPEATED },
  render: (args) => (
    <div className="h-[900px] w-96">
      <Rail {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await document.fonts.ready;

    const rail = canvas.getByRole('complementary', { name: 'Sources' });
    await expect(canvas.getAllByRole('article')).toHaveLength(14);
    await expect(rail.scrollHeight).toBeLessThanOrEqual(rail.clientHeight);
  },
};

export const ArrivingWithASourceOpensAtThatCard: Story = {
  args: { sources: REPEATED, activeSource: LAST.id },
  play: async ({ canvas }) => {
    await document.fonts.ready;

    const rail = canvas.getByRole('complementary', { name: 'Sources' });
    await expect(rail.scrollTop).toBeGreaterThan(0);
    await expect(markedCard(rail)).toHaveTextContent(LAST.title);
  },
};

export const TheRailMovesWhenTheMarkChanges: Story = {
  render: () => <RailUnderAMovingMark />,
  play: async ({ canvas }) => {
    await document.fonts.ready;

    const rail = canvas.getByRole('complementary', { name: 'Sources' });
    const before = rail.scrollTop;
    await expect(markedCard(rail)).toHaveTextContent(FIRST.title);

    await userEvent.click(canvas.getByRole('button', { name: MOVE }));

    await expect(rail.scrollTop).not.toBe(before);
    await expect(markedCard(rail)).toHaveTextContent(LAST.title);
  },
};

export const EachDocumentIsListedOnce: Story = {
  args: { sources: REPEATED },
  play: async ({ canvas }) => {
    const cards = canvas.getAllByRole('article');
    await expect(cards.length).toBe(REPEATED.length);

    const drawn = cards.map((card) => card.getAttribute('data-source'));
    await expect(new Set(drawn).size).toBe(cards.length);

    const numbers = cards.map((card) => Number(card.querySelector('span')?.textContent ?? ''));
    for (let index = 1; index < numbers.length; index += 1) {
      await expect(numbers[index] ?? Number.NaN).toBeGreaterThan(numbers[index - 1] ?? Number.NaN);
    }
  },
};
