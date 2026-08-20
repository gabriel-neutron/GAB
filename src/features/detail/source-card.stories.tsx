import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import type { DocId } from '@/shared/fixtures/types';

import { readDossier, type SourceCardModel } from './dossier';
import { SourceCard } from './source-card';

/**
 * The three addresses of a document are all reachable, and an absent one says so.
 *
 * The input is `readDossier(corpus, …)`, which is what the page calls, so this file changes on
 * the day `src/contract/` replaces the fixtures. It invents no row: `doc_8f2a41` is the rated
 * report with all three addresses, and `manual` is the row that carries none of them and no
 * rating either.
 *
 * Each assertion reads a role, an accessible name, an `aria-` attribute or the text. A class
 * name and a colour are the interior of the component, and they change with the theme.
 */

/** MV Northern Ledger. Its claims cite `doc_9b0417`, `doc_8f2a41` and `manual`. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const SOURCES: readonly SourceCardModel[] = readDossier(corpus, VESSEL)?.sources ?? [];

const sourceOf = (id: DocId): SourceCardModel => {
  const found = SOURCES.find((source) => source.id === id);
  if (found === undefined) throw new Error(`The committed corpus does not cite ${id} here`);
  return found;
};

/** A value the story asserts on. The corpus states it, and the story never invents one. */
const stated = (value: string | null, what: string): string => {
  if (value === null) throw new Error(`The committed corpus carries no ${what}`);
  return value;
};

const RATED = sourceOf('doc_8f2a41');
const UNRATED = sourceOf('manual');

const ORIGINAL = stated(RATED.uri, 'original address for doc_8f2a41');
const DISCLOSURE = /Claims/;

const meta = {
  component: SourceCard,
  args: { source: RATED },
  // The card sits in a 24 rem rail, and the two lines are measured at that width, so every
  // story states it.
  render: (args) => (
    <div className="w-96">
      <SourceCard {...args} />
    </div>
  ),
} satisfies Meta<typeof SourceCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The web-archive address and the printed hash are removed from this card, and **the tracker
 * owns how a reader reaches a source file**. What is left of the disclosure is the claims the
 * document holds up.
 *
 * The original address stays on the face of the card, and it is one link.
 */
export const TheOriginalAddressIsOnTheCard: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('link', { name: /original document/ })).toHaveAttribute(
      'href',
      ORIGINAL,
    );

    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    // Neither the archive link nor the hash comes back.
    await expect(canvas.queryByRole('link', { name: /web archive/ })).toBeNull();
    await expect(canvasElement.querySelector('.font-mono')).toBeNull();
  },
};

/**
 * A scan with no address says so. `manual` is a real document row with no address at all — M8
 * makes it a legitimate source — and the surface writes the absence in words. Never `N/A`,
 * never `—`, never `0`: each of those reads as a value that the surface lost.
 *
 * **The defect this replaces:** the story asserted the words of the original address and of the
 * date, and it never clicked the disclosure. A document carries three addresses, and the two
 * behind the control — the archive address and the hash — were never rendered and never
 * asserted: both could be deleted and the story still passed. Its `queryByRole('link')` was
 * self-satisfying for the same reason, because a closed disclosure holds no link whatever the
 * code does. **The story reaches all three addresses, and the assertion on the links is made
 * with the panel open.**
 */
export const AnAbsentAddressSaysSo: Story = {
  args: { source: UNRATED },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No address recorded')).toBeInTheDocument();
    await expect(canvas.getByText('No date of retrieval')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    await expect(canvas.getByText('No archive address recorded')).toBeInTheDocument();
    await expect(canvas.getByText('No hash recorded')).toBeInTheDocument();

    // The panel is open, so an archive link would be in the tree if the card drew one.
    await expect(canvas.queryByRole('link')).toBeNull();

    await expect(canvas.queryByText('—')).toBeNull();
    await expect(canvas.queryByText('N/A')).toBeNull();
    await expect(canvas.queryByText('0')).toBeNull();
  },
};

/**
 * Invariant 6: the rating and its origin are absent together, and an absence must never read as
 * a low score. The card says `not rated`, and no ADMIRALTY code appears.
 */
export const AnUnratedDocumentSaysNotRated: Story = {
  args: { source: UNRATED },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('not rated')).toBeInTheDocument();
    await expect(canvas.queryByText(/^[A-F][1-6]$/)).toBeNull();
  },
};

/** Behind the control are the claims this document holds up, each one named. */
export const AClaimTheDocumentHoldsUpIsNamed: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    await expect(canvas.getAllByRole('listitem')).toHaveLength(RATED.holdsUp.length);
    for (const claim of RATED.holdsUp) {
      await expect(canvas.getByText(claim.label)).toBeInTheDocument();
      await expect(canvas.getByText(claim.text)).toBeInTheDocument();
    }
  },
};
