import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import type { Corpus, DocumentRow } from '@/shared/fixtures/types';

import { readDossier, type SourceRef } from './dossier';
import { SourceMark } from './mark';

/**
 * The states of the mark that carries the provenance of one claim, one relation or one proposal.
 *
 * `docs/detail-surface.md` §5.1 is the contract: a claim never appears without a mark to its
 * source, and no control hides it. §3.6 makes the visible badge a number alone, and §4.4 makes a
 * click name the document for the caller to act on.
 *
 * **This file exists because a story file holds the states of one component.** These stories sat
 * in `record.stories.tsx`, which is the story file of `EntityRecord`.
 *
 * **Every row below is invented**, as `src/shared/fixtures/corpus.ts` says of its own rows, and
 * nothing outside this file reads it. The refs come from `readDossier`, which is what the page
 * calls, so the accessible name is the one the surface writes and the story states none of its
 * own.
 */

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

/**
 * This file holds the **page** control alone. #68 split the sidebar control off as `SourceCount`,
 * because a number on a surface with no rail points at nothing, and `sidebar.stories.tsx` holds
 * that one: it has a dossier to open and a page to hand a document to.
 */
const meta = {
  component: SourceMark,
  args: { sources: SOURCES, activeSource: null, onSelectSource },
} satisfies Meta<typeof SourceMark>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * §4.4: a click on a mark names the document, and the caller decides what moves. §3.6: the
 * visible text is the number alone, and the accessible name names the document.
 */
export const AClickOnAMarkNamesTheDocument: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: ONE.name }));
    await expect(onSelectSource).toHaveBeenCalledWith(ONE.id);
  },
};

/**
 * §3.6: the accessible name names the document and never its score. A document that holds up
 * twenty claims once announced `B2, machine` twenty times, which is the per-claim score §3.6
 * calls false. The score stays on the card in the rail, once.
 */
export const TheNameOfAMarkCarriesNoScore: Story = {
  play: async ({ canvas }) => {
    const mark = canvas.getByRole('button', { name: ONE.name });
    await expect(mark).toHaveTextContent('1');
    await expect(ONE.name).toBe(`Source 1 — ${DOCUMENT.title}`);
    await expect(ONE.name).not.toContain('B2');
  },
};

/**
 * §5.1 and invariant 1: every claim carries at least one source, so an empty list is a fault in
 * the data. **The defect this proves is corrected:** an empty list once rendered an empty
 * element, and a claim with no provenance drew nothing at all. The surface says it in words.
 */
export const AClaimWithNoSourceSaysSo: Story = {
  args: { sources: [] },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/No source recorded/)).toBeInTheDocument();
    await expect(canvas.queryByRole('button')).toBeNull();
    // Never a dash and never a blank: each of those reads as a value the surface lost.
    await expect(canvas.queryByText('—')).toBeNull();
  },
};
