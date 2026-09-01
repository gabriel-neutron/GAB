import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import type { Corpus, DocumentRow } from '@/shared/read/model';

import { readDossier, type SourceRef } from './dossier';
import { SourceMark } from './mark';

const DOCUMENT: DocumentRow = {
  id: 'doc-imo',
  kind: 'report',
  title: 'IMO number certificate, 2019',
  uri: 'https://example.invalid/doc-imo',
  archiveUri: null,
  sha256: null,
  retrievedAt: '2026-02-11',
  admiralty: 'B2',
  admiraltyOrigin: 'machine',
};

const CORPUS: Corpus = {
  documents: [DOCUMENT],
  entities: [
    {
      id: 'probe-1',
      type: 'vessel',
      proposedType: null,
      label: 'Northern Aurora',
      attrs: {},
      sources: [DOCUMENT.id],
      geom: null,
      promotedFrom: 'proposal-probe-1',
    },
  ],
  relations: [],
  proposals: [],
};

const SOURCES: readonly SourceRef[] = readDossier(CORPUS, 'probe-1', [])?.entitySources ?? [];

const first = (): SourceRef => {
  const held = SOURCES[0];
  if (held === undefined) throw new Error('The probe corpus cites no document on this entity');
  return held;
};

const ONE = first();

const onSelectSource = fn();

const meta = {
  component: SourceMark,
  args: { sources: SOURCES, activeSource: null, onSelectSource },
} satisfies Meta<typeof SourceMark>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AClickOnAMarkNamesTheDocument: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: ONE.name }));
    await expect(onSelectSource).toHaveBeenCalledWith(ONE.id);
  },
};

export const TheNameOfAMarkCarriesNoScore: Story = {
  play: async ({ canvas }) => {
    const mark = canvas.getByRole('button', { name: ONE.name });
    await expect(mark).toHaveTextContent('1');
    await expect(ONE.name).toBe(`Source 1 — ${DOCUMENT.title}`);
    await expect(ONE.name).not.toContain('B2');
  },
};

export const AClaimWithNoSourceSaysSo: Story = {
  args: { sources: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/No source recorded/)).toBeInTheDocument();
    await expect(canvas.queryByRole('button')).toBeNull();
    // Never a dash and never a blank: each of those reads as a value the surface lost.
    await expect(canvas.queryByText('—')).toBeNull();
  },
};

// A claim cell is a flex row of a fixed width, and the sentence is the widest thing that can
// stand in one. Held at its own width, it measured 308 px inside a 275 px cell and drew over the
// value of the claim beside it: a fault in the data then hid a value that was sound.
export const TheSentenceOfAMissingSourceStaysInsideItsClaim: Story = {
  args: { sources: [] },
  render: (args) => (
    <div data-cell="" className="flex w-[275px] items-center">
      <SourceMark {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const cell = canvasElement.querySelector('[data-cell]');
    if (cell === null) throw new Error('The story drew no cell');

    const sentence = canvas.getByText(/No source recorded/);
    // A rounding of the layout gives a fraction of a pixel, and one pixel is not an overlap.
    await expect(sentence.getBoundingClientRect().right).toBeLessThanOrEqual(
      cell.getBoundingClientRect().right + 1,
    );
  },
};
