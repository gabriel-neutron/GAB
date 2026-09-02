import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect, fn } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import { vocabulary } from '@/shared/fixtures/vocabulary';

import { Band } from './band';
import { recordCells } from './draft';
import { readDossier, type PendingLine, type RecordRow, type SourceRef } from './dossier';
import { SourceMark } from './mark';
import { Pending } from './pending';
import { EntityRecord } from './record';

/**
 * Maasvlakte bulk terminal, berth 7. Two proposals: one at dissent 0.82, one at 0.41.
 */
const FACILITY = 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8';

const DOSSIER = readDossier(corpus, FACILITY, vocabulary);

const PROPOSALS: readonly PendingLine[] = DOSSIER?.pending ?? [];

const CLAIMS: readonly RecordRow[] = DOSSIER?.rows ?? [];

const rows = (root: HTMLElement): readonly HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-proposal]'));

const onSelectSource = fn();

const mark = (sources: readonly SourceRef[]): ReactNode => (
  <SourceMark sources={sources} activeSource={null} onSelectSource={onSelectSource} />
);

const meta = {
  component: Pending,
  args: { proposals: PROPOSALS, mark },
  parameters: { layout: 'fullscreen' },
  // A proposal is one row, and a row truncates, so the width is fixed at 900px.
  render: (args) => (
    <div className="w-[900px] p-2">
      <Pending {...args} />
    </div>
  ),
} satisfies Meta<typeof Pending>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ACandidateIsMarkedInWords: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(rows(canvasElement)).toHaveLength(PROPOSALS.length);
    await expect(canvas.getAllByText('candidate')).toHaveLength(PROPOSALS.length);
  },
};

/**
 * There is no theme decorator in `.storybook/preview.ts`, so this story sets the class itself.
 */
export const ACandidateIsMarkedInWordsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark w-[900px] bg-background p-2 text-foreground">
      <Pending {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByText('candidate')).toHaveLength(PROPOSALS.length);
  },
};

export const NoControlActsOnAProposal: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole('button', { name: /accept|reject|approve|promote/i }),
    ).toBeNull();
  },
};

export const ACandidateIsNeverMixedIntoTheRecord: Story = {
  render: (args) => (
    <div className="w-[900px] p-2">
      <Band name="The record" count={CLAIMS.length}>
        <EntityRecord mode="reading" cells={recordCells(CLAIMS, null)} mark={mark} />
      </Band>
      <Band name="Pending proposals" count={PROPOSALS.length}>
        <Pending {...args} />
      </Band>
    </div>
  ),
  play: async ({ canvas }) => {
    const record = canvas.getByRole('region', { name: 'The record' });
    const pending = canvas.getByRole('region', { name: 'Pending proposals' });

    await expect(canvas.getAllByRole('region')).toHaveLength(2);
    await expect(record.querySelectorAll('[data-claim]').length).toBeGreaterThan(0);

    await expect(rows(record)).toHaveLength(0);
    await expect(rows(pending)).toHaveLength(PROPOSALS.length);
    await expect(rows(pending).length).toBeGreaterThan(0);
  },
};

export const DissentAndConfidenceAreWritten: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('dissent')).toBeInTheDocument();
    await expect(canvas.getByText('no dissent')).toBeInTheDocument();
    await expect(canvas.getByText('0.82')).toBeInTheDocument();
    await expect(canvas.getByText('0.41')).toBeInTheDocument();
  },
};
