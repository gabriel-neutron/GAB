import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import type { DocId } from '@/shared/fixtures/types';

import { readDossier, type SourceCardModel } from './dossier';
import { SourceCard } from './source-card';

/**
 * The check of step 3 of `docs/detail-surface.md` §8: the three addresses of #31 are all
 * reachable, and an absent one says so. §4.3 is the contract and §3.3 is the finding.
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
const ARCHIVE = stated(RATED.archiveUri, 'archive address for doc_8f2a41');
const HASH = stated(RATED.sha256, 'hash for doc_8f2a41');

const DISCLOSURE = /Archive, hash and claims/;

const meta = {
  component: SourceCard,
  args: { source: RATED },
  // §4.4 puts the card in a 24 rem rail, and the two lines of §3.3 are measured at that width,
  // so every story states it.
  render: (args) => (
    <div className="w-96">
      <SourceCard {...args} />
    </div>
  ),
} satisfies Meta<typeof SourceCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * #31: the bucket is private, so the reader is given the original address, the web-archive
 * address and the file hash. All three are reachable from this one card.
 */
export const AllThreeAddressesAreReachable: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: /original document/ })).toHaveAttribute(
      'href',
      ORIGINAL,
    );

    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    await expect(canvas.getByRole('link', { name: /web archive/ })).toHaveAttribute(
      'href',
      ARCHIVE,
    );
    await expect(canvas.getByText(HASH)).toBeInTheDocument();
  },
};

/** §4.3 "Works when": the hash is one click away, and it is not on the two lines. */
export const TheHashIsOneClickAway: Story = {
  play: async ({ canvas }) => {
    const control = canvas.getByRole('button', { name: DISCLOSURE });
    await expect(control).toHaveAttribute('aria-expanded', 'false');
    await expect(canvas.queryByText(HASH)).toBeNull();

    await userEvent.click(control);

    await expect(control).toHaveAttribute('aria-expanded', 'true');
    await expect(canvas.getByText(HASH)).toBeInTheDocument();
  },
};

/**
 * §4.3: a scan with no address says so. `manual` is a real document row (M8) with no address at
 * all, and the surface writes the absence in words. Never `N/A`, never `—`, never `0`: each of
 * those reads as a value that the surface lost.
 *
 * **The defect this replaces:** the story asserted the words of the original address and of the
 * date, and it never clicked the disclosure. #31 names three addresses, and the two behind the
 * control — the archive address and the hash — were never rendered and never asserted: both
 * could be deleted and the story still passed. Its `queryByRole('link')` was self-satisfying for
 * the same reason, because a closed disclosure holds no link whatever the code does. **The story
 * reaches all three addresses, and the assertion on the links is made with the panel open.**
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

/** §4.3: behind the control are the claims this document holds up, each one named. */
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
