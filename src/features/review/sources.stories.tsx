import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent } from 'storybook/test';

import type { Corpus, DocId } from '@/shared/read/model';

import { readQueue, type CitedDocument, type Subject } from './queue';
import { reviewSample } from './sample';
import { SourceBadge } from './sources';

const HELD: CitedDocument = {
  id: 'doc_3c1104',
  title: 'Corporate registry extract — Meridian Bulk Carriers Ltd',
  address: {
    kind: 'ingest-copy',
    href: 'https://web.archive.example.invalid/2026/registry-meridian',
  },
  missing: false,
  name: 'Corporate registry extract — Meridian Bulk Carriers Ltd',
};

const citedIn = (subjects: readonly Subject[], id: DocId): CitedDocument => {
  const found = subjects
    .flatMap((subject) => subject.changes)
    .flatMap((change) => [
      ...change.sources,
      ...change.rows.flatMap((row) => [...row.standingSources, ...row.proposedSources]),
    ])
    .find((source) => source.id === id);
  if (found === undefined) throw new Error(`No act of the review sample cites ${id}`);
  return found;
};

const ABSENT: CitedDocument = citedIn(readQueue(reviewSample), 'doc_0000ff');

const ORIGINAL_ID: DocId = 'doc_3c1104';
const ORIGINAL_ADDRESS = 'https://registry.example/entry';

const WITHOUT_ARCHIVE: Corpus = {
  ...reviewSample,
  documents: reviewSample.documents.map((row) =>
    row.id === ORIGINAL_ID ? { ...row, uri: ORIGINAL_ADDRESS, archiveUri: null } : row,
  ),
};

const ORIGINAL_ONLY: CitedDocument = citedIn(readQueue(WITHOUT_ARCHIVE), ORIGINAL_ID);

const meta = {
  component: SourceBadge,
  args: { source: HELD },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="flex w-[560px] items-center gap-1 p-2">
      <SourceBadge {...args} />
    </div>
  ),
} satisfies Meta<typeof SourceBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The badge names the document, and it draws no rating, no figure and no word of a score. */
export const TheBadgeNamesTheDocumentAndNoRating: Story = {
  play: async ({ canvas }) => {
    const badge = canvas.getByRole('button', { name: HELD.title });
    await expect(badge.textContent).toEqual('');
    await expect(badge).not.toHaveAttribute('data-band');
    await expect(canvas.queryByText(/not rated|rating/)).toBeNull();
  },
};

/** The document is one press away, and no value on the card prints it. The panel is portalled
 * to the body, so it is found on the screen and never inside the canvas. */
export const TheDocumentIsOnePressAway: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Corporate registry extract/ }));
    await expect(await screen.findByText(/Open the copy taken at ingest/)).toBeInTheDocument();
  },
};

/** A document with no copy taken at ingest opens its original address, and the link says so: that
 * page can change after ingest, so it is never called the copy. */
export const TheOriginalAddressIsNeverCalledTheCopy: Story = {
  args: { source: ORIGINAL_ONLY },
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Corporate registry extract/ }));
    const link = await screen.findByRole('link', { name: /Open the original address/ });
    await expect(link).toHaveAttribute('href', ORIGINAL_ADDRESS);
    await expect(screen.queryByText(/Open the copy taken at ingest/)).toBeNull();
  },
};

/** A cited document with no row is drawn and never hidden: dropped evidence is worse. */
export const ACitedDocumentWithNoRowIsDrawn: Story = {
  args: { source: ABSENT },
  play: async ({ canvas }) => {
    const badge = canvas.getByRole('button', { name: /absent from the record/ });
    await userEvent.click(badge);
    await expect(
      await screen.findByText('This document is cited, and the record holds no row for it.'),
    ).toBeInTheDocument();
  },
};

// Origin of a number: the `--label` token of the dark theme.
const DARK_LABEL = 'oklch(0.63 0.008 215)';

export const TheBadgeHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark flex w-[560px] items-center gap-1 bg-background p-2 text-foreground">
      <SourceBadge {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const badge = canvas.getByRole('button', { name: /Corporate registry extract/ });
    await expect(getComputedStyle(badge).color).toBe(DARK_LABEL);
  },
};
