import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, restoreAllMocks, userEvent } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { toDomain } from '@/shared/read/map';
import type { Corpus, DocId } from '@/shared/read/model';
import { holdWriter } from '@/shared/write/hold-writer.story-support';

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

const DISCLOSURE = /Facts \(/;

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
  beforeEach: async () => {
    await holdWriter(true);
    return () => {
      restoreAllMocks();
    };
  },
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
    await expect(canvas.getByText('No retrieval date recorded')).toBeInTheDocument();

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

export const AnAttributeTheDocumentHoldsUpIsNamedUnderItsOwnHeading: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    await expect(
      canvas.getByText(`Attributes this document backs (${REPORT.holdsUp.length})`),
    ).toBeInTheDocument();
    for (const claim of REPORT.holdsUp) {
      await expect(canvas.getByText(claim.label)).toBeInTheDocument();
      await expect(canvas.getByText(claim.text)).toBeInTheDocument();
    }
  },
};

export const ARelationTheDocumentBacksIsNamedAsAFact: Story = {
  args: { source: { ...REPORT, backs: [{ key: 'r1', text: 'Quartanus designated by an act' }] } },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    await expect(canvas.getByText('Facts this document backs (1)')).toBeInTheDocument();
    await expect(canvas.getByText('Quartanus designated by an act')).toBeInTheDocument();
  },
};

export const ADocumentThatBacksNoAttributeDrawsNoAttributeHeading: Story = {
  args: {
    source: {
      ...REPORT,
      holdsUp: [],
      backs: [{ key: 'r1', text: 'Quartanus designated by an act' }],
    },
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));

    await expect(canvas.queryByText(/Attributes this document backs/)).toBeNull();
  },
};

export const ADocumentThatBacksNothingSaysSoInAPlainSentence: Story = {
  args: { source: { ...REPORT, holdsUp: [], backs: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('This document backs no fact on this page.')).toBeInTheDocument();
    await expect(canvas.queryByRole('button', { name: DISCLOSURE })).toBeNull();
  },
};

// The record holds the bytes of this document, so the operator can extract its claims here.
export const AStoredDocumentOffersAnExtraction: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));
    await expect(canvas.getByRole('button', { name: 'Extract claims' })).toBeEnabled();
  },
};

export const TheDateAndTheKindAreLabelled: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Report')).toBeInTheDocument();
    await expect(canvas.getByText(/^Retrieved on \d{4}-\d{2}-\d{2}$/)).toBeInTheDocument();
  },
};

export const AHandEntryNamesItsKind: Story = {
  args: { source: HAND_ENTRY },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Manual entry')).toBeInTheDocument();
  },
};

export const AnImportSaysItHasNoWebAddress: Story = {
  args: { source: { ...REPORT, uri: null, uriShort: null, kind: 'Import', imported: true } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Import')).toBeInTheDocument();
    await expect(canvas.getByText('Import dataset, no web address')).toBeInTheDocument();
    await expect(canvas.queryByText(NO_WEB_ADDRESS)).toBeNull();
  },
};

export const AnExtractionIsExplainedBeforeItsControl: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));
    await expect(canvas.getByText(/reads the stored document/)).toBeInTheDocument();
  },
};

// With the write service off, the card offers no extraction.
export const AnOfflineWriterOffersNoExtraction: Story = {
  beforeEach: async () => {
    await holdWriter(false);
  },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: DISCLOSURE }));
    await expect(canvas.queryByRole('button', { name: 'Extract claims' })).toBeNull();
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
