import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import type { DocId } from '@/shared/fixtures/types';

import { readDossier, type SourceCardModel } from './dossier';
import { Rail } from './rail';

/**
 * A badge scrolls the rail alone, and arriving with `?src=` opens at that card. The two panes
 * stay apart.
 *
 * **One half of that check no story can reach.** "A badge scrolls the rail **alone**" needs the
 * record and the rail on one page, and `eslint.config.ts` refuses an import of a `-page` file
 * from any story. The stories below prove that the rail moves when the mark moves, and that it
 * moves nothing else; the composition of the whole route is proved by the `visual-qa` agent.
 *
 * The input is `readDossier(corpus, …)`, which is what the page calls, so this file changes on
 * the day `src/contract/` replaces the fixtures.
 */

/** MV Northern Ledger. Its claims cite `doc_9b0417`, `doc_8f2a41` and `manual`. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const SOURCES: readonly SourceCardModel[] = readDossier(corpus, VESSEL)?.sources ?? [];

/**
 * The density is measured on fourteen documents, and the committed corpus cites fewer here.
 * The rows below **repeat the real ones and are a story fixture**, exactly as the density probe
 * of `record.stories.tsx` is: every repeated row is invented, nothing outside this file reads
 * them, and they die with the story.
 */
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

/**
 * **`document.fonts.ready` is awaited before every geometry read of this file.**
 *
 * The defect this exists to not repeat: `scrollHeight`, `clientHeight` and `scrollTop` were read
 * with no wait. `src/index.css` records that `Roboto Condensed` and `JetBrains Mono` are not
 * installed yet, so a card is measured in a fallback font today. The day a `@fontsource` package
 * lands, each card reflows after a measurement that did not wait, and each assertion below
 * flakes — `FourteenDocumentsFitOneScreen` first, because it measures a boundary.
 */

/** The card that carries the mark. `aria-current` is the contract; the paint is the interior. */
const markedCard = (rail: HTMLElement): HTMLElement => {
  const found = rail.querySelector<HTMLElement>('[aria-current="true"]');
  if (found === null) throw new Error('No card carries `aria-current`');
  return found;
};

/**
 * The mark moves, and the rail follows it on its own. The button stands in for
 * the badge in the record, which lives on the other pane and which a story cannot mount.
 */
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

/**
 * Fourteen documents fit one screen. An eight-line card put fourteen documents on three
 * screens. The height below is one 900 px screen, and the whole rail fits inside it with no
 * scroll.
 */
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

/**
 * Arriving with a source named opens the page at that card. `activeSource` is already set at
 * mount, so the mount run of the one effect in `./rail` is the arrival case, and no second
 * mechanism exists for it. This is the storyable half of that check.
 */
export const ArrivingWithASourceOpensAtThatCard: Story = {
  args: { sources: REPEATED, activeSource: LAST.id },
  play: async ({ canvas }) => {
    await document.fonts.ready;

    const rail = canvas.getByRole('complementary', { name: 'Sources' });
    await expect(rail.scrollTop).toBeGreaterThan(0);
    await expect(markedCard(rail)).toHaveTextContent(LAST.title);
  },
};

/** The rail moves on its own when the mark moves, and it marks the new card. */
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

/**
 * Each cited document is listed once, and it is numbered in the order it is met.
 *
 * **The defect this replaces:** the story counted the distinct identifiers of `SOURCES` and
 * compared that count to the number of cards. `readDossier` already de-duplicates and `Rail` is
 * one `.map` over what it is handed, so the assertion read `SOURCES.length === SOURCES.length`
 * and no implementation of `Rail` could fail it. **Every value below is read from the DOM.**
 */
export const EachDocumentIsListedOnce: Story = {
  args: { sources: REPEATED },
  play: async ({ canvas }) => {
    const cards = canvas.getAllByRole('article');
    await expect(cards.length).toBe(REPEATED.length);

    // A card drawn twice raises the count of cards and never the count of identifiers, so the
    // two counts part company. `data-source` is the identifier the card carries.
    const drawn = cards.map((card) => card.getAttribute('data-source'));
    await expect(new Set(drawn).size).toBe(cards.length);

    // Numbered in the order it is met. A number that repeats or that goes backwards is a
    // second answer to "which document is number 7".
    const numbers = cards.map((card) => Number(card.querySelector('span')?.textContent ?? ''));
    for (let index = 1; index < numbers.length; index += 1) {
      await expect(numbers[index] ?? Number.NaN).toBeGreaterThan(numbers[index - 1] ?? Number.NaN);
    }
  },
};
