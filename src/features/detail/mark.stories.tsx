import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import type { Corpus, DocumentRow } from '@/shared/fixtures/types';

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
      label: 'Northern Aurora',
      attrs: {},
      sources: [DOCUMENT.id],
      geom: null,
      promotedFrom: 'proposal-probe-1',
    },
  ],
  relations: [],
  proposals: [],
  agents: [],
  agentCalls: [],
};

const SOURCES: readonly SourceRef[] = readDossier(CORPUS, 'probe-1')?.entitySources ?? [];

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
