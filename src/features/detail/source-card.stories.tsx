import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { toDomain } from '@/shared/read/map';
import type { Corpus, DocId } from '@/shared/read/model';

import { readDossier, type SourceCardModel } from './dossier';
import { SourceCard } from './source-card';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

/** MV Northern Ledger. Its claims cite `doc_9b0417`, `doc_8f2a41` and `manual`. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const cardsOf = (read: Corpus): readonly SourceCardModel[] =>
  readDossier(read, VESSEL, entityTypes, [])?.sources ?? [];

const SOURCES: readonly SourceCardModel[] = cardsOf(corpus);

const sourceIn = (cards: readonly SourceCardModel[], id: DocId): SourceCardModel => {
  const found = cards.find((source) => source.id === id);
  if (found === undefined) throw new Error(`The corpus of this story does not cite ${id} here`);
  return found;
};

const sourceOf = (id: DocId): SourceCardModel => sourceIn(SOURCES, id);

const LOG_ID: DocId = 'doc_9b0417';

// A CHECK holds every cited document to a row, so the committed corpus never reaches this state.
// The corpus below is read by `readDossier`.
const WITHOUT_ROW: Corpus = {
  ...corpus,
  documents: corpus.documents.filter((row) => row.id !== LOG_ID),
};

const stated = (value: string | null, what: string): string => {
  if (value === null) throw new Error(`The committed corpus carries no ${what}`);
  return value;
};

const REPORT = sourceOf('doc_8f2a41');
const HAND_ENTRY = sourceOf('manual');
const MISSING = sourceIn(cardsOf(WITHOUT_ROW), LOG_ID);

const ORIGINAL = stated(REPORT.uri, 'original address for doc_8f2a41');

const HASH = stated(
  corpus.documents.find((row) => row.id === REPORT.id)?.sha256 ?? null,
  'hash for doc_8f2a41',
);

const DISCLOSURE = /Claims/;

const NO_WEB_ADDRESS = 'No web address recorded';

const addressed = (uri: string): SourceCardModel => {
  const held = corpus.documents.find((row) => row.id === REPORT.id);
  if (held === undefined) throw new Error('The committed corpus carries no doc_8f2a41');
  const read = toDomain.document({
    id: held.id,
    kind: held.kind,
    title: held.title,
    uri,
    archive_uri: null,
    sha256: held.sha256,
    mime: null,
    retrieved_at: held.retrievedAt,
    created_at: null,
    cost_eur: null,
  });
  const documents = corpus.documents.map((row) => (row.id === read.id ? read : row));
  return sourceIn(cardsOf({ ...corpus, documents }), read.id);
};

const meta = {
  component: SourceCard,
  args: { source: REPORT },
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
  args: { source: HAND_ENTRY },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(NO_WEB_ADDRESS)).toBeInTheDocument();
    await expect(canvas.getByText('No date of retrieval')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    // The panel is open, so an archive link would be in the tree if the card drew one.
    await expect(canvas.queryByRole('link')).toBeNull();

    await expect(canvas.queryByText('—')).toBeNull();
    await expect(canvas.queryByText('N/A')).toBeNull();
    await expect(canvas.queryByText('0')).toBeNull();
  },
};

export const AWebAddressIsALink: Story = {
  args: { source: addressed('https://registry.example/e') },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: /original document/ })).toHaveAttribute(
      'href',
      'https://registry.example/e',
    );
  },
};

export const AFileAddressIsNoLink: Story = {
  args: { source: addressed('file:///etc/passwd') },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('link')).toBeNull();
    await expect(canvas.getByText(NO_WEB_ADDRESS)).toBeInTheDocument();
  },
};

export const AHandlerAddressIsNoLink: Story = {
  args: { source: addressed('ms-msdt:x') },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('link')).toBeNull();
    await expect(canvas.getByText(NO_WEB_ADDRESS)).toBeInTheDocument();
  },
};

/** A card names the document, and it draws no rating and no word of a score. */
export const ACardDrawsNoRating: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('article')).not.toHaveAttribute('data-band');
    await expect(canvas.queryByText(/not rated|rating/)).toBeNull();
    await expect(canvas.queryByText(/^[A-F][1-6]/)).toBeNull();
  },
};

export const AMissingDocumentSaysMissing: Story = {
  args: { source: MISSING },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('This document is cited and it has no row in the record.'),
    ).toBeInTheDocument();
  },
};

export const AClaimTheDocumentHoldsUpIsNamed: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    await expect(canvas.getAllByRole('listitem')).toHaveLength(REPORT.holdsUp.length);
    for (const claim of REPORT.holdsUp) {
      await expect(canvas.getByText(claim.label)).toBeInTheDocument();
      await expect(canvas.getByText(claim.text)).toBeInTheDocument();
    }
  },
};

// The record holds the bytes of this document, so the operator can extract its claims here.
export const AStoredDocumentOffersAnExtraction: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));
    await expect(canvas.getByRole('button', { name: 'Extract claims' })).toBeEnabled();
  },
};

// A hand entry holds no bytes, so nothing can be extracted from it.
export const AHandEntryOffersNoExtraction: Story = {
  args: { source: HAND_ENTRY },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));
    await expect(canvas.queryByRole('button', { name: 'Extract claims' })).toBeNull();
  },
};
