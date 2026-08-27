import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import { vocabulary } from '@/shared/fixtures/vocabulary';
import type { DocId } from '@/shared/read/model';

import { readDossier, type SourceCardModel } from './dossier';
import { SourceCard } from './source-card';

/** MV Northern Ledger. Its claims cite `doc_9b0417`, `doc_8f2a41` and `manual`. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const SOURCES: readonly SourceCardModel[] = readDossier(corpus, VESSEL, vocabulary)?.sources ?? [];

const sourceOf = (id: DocId): SourceCardModel => {
  const found = SOURCES.find((source) => source.id === id);
  if (found === undefined) throw new Error(`The committed corpus does not cite ${id} here`);
  return found;
};

const stated = (value: string | null, what: string): string => {
  if (value === null) throw new Error(`The committed corpus carries no ${what}`);
  return value;
};

const RATED = sourceOf('doc_8f2a41');
const UNRATED = sourceOf('manual');

const ORIGINAL = stated(RATED.uri, 'original address for doc_8f2a41');

const HASH = stated(
  corpus.documents.find((row) => row.id === RATED.id)?.sha256 ?? null,
  'hash for doc_8f2a41',
);

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

export const TheOriginalAddressIsOnTheCard: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: /original document/ })).toHaveAttribute(
      'href',
      ORIGINAL,
    );

    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    await expect(canvas.queryByRole('link', { name: /web archive/ })).toBeNull();
    await expect(canvas.queryByText(HASH)).toBeNull();
  },
};

/**
 * M8: `manual` carries no address at all, and it is still a legitimate source.
 */
export const AnAbsentAddressSaysSo: Story = {
  args: { source: UNRATED },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('No address recorded')).toBeInTheDocument();
    await expect(canvas.getByText('No date of retrieval')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    // The panel is open, so an archive link would be in the tree if the card drew one.
    await expect(canvas.queryByRole('link')).toBeNull();

    await expect(canvas.queryByText('—')).toBeNull();
    await expect(canvas.queryByText('N/A')).toBeNull();
    await expect(canvas.queryByText('0')).toBeNull();
  },
};

export const AnUnratedDocumentSaysNotRated: Story = {
  args: { source: UNRATED },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('not rated')).toBeInTheDocument();
    await expect(canvas.queryByText(/^[A-F][1-6]$/)).toBeNull();
  },
};

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
