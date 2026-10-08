import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect, fn, within } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

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

const DOSSIER = readDossier(corpus, FACILITY, entityTypes, []);

const PROPOSALS: readonly PendingLine[] = DOSSIER?.pending ?? [];

const CLAIMS: readonly RecordRow[] = DOSSIER?.rows ?? [];

const AGENT_ACT = corpus.proposals.find(
  (proposal) => proposal.targetId === FACILITY && proposal.status === 'pending',
);

const OPERATOR_ACT_ID = '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d';

// An undecided operator save leaves a pending operator act. The fixture holds none, so this
// story adds one beside the agent acts.
const MIXED: readonly PendingLine[] =
  AGENT_ACT === undefined
    ? []
    : (readDossier(
        {
          ...corpus,
          proposals: [
            ...corpus.proposals,
            { ...AGENT_ACT, id: OPERATOR_ACT_ID, authorRole: 'gabriel_app', proposer: 'operator' },
          ],
        },
        FACILITY,
        entityTypes,
        [],
      )?.pending ?? []);

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
 * There is no theme decorator for Storybook, so this story sets the class itself.
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

export const DissentIsWrittenAndNoConfidence: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('disputed')).toBeInTheDocument();
    await expect(canvas.getByText('not disputed')).toBeInTheDocument();
    await expect(canvas.queryByText(/^\d\.\d\d$/)).toBeNull();
  },
};

export const EachCandidateStatesItsOrigin: Story = {
  args: { proposals: MIXED },
  play: async ({ canvasElement }) => {
    const row = (id: string): HTMLElement => {
      const found = rows(canvasElement).find((line) => line.dataset['proposal'] === id);
      if (found === undefined) throw new Error(`no line for the act ${id}`);
      return found;
    };
    const agent = within(row(AGENT_ACT?.id ?? ''));
    const operator = within(row(OPERATOR_ACT_ID));

    await expect(agent.getByText('candidate')).toBeInTheDocument();
    await expect(agent.getByText('extractor')).toBeInTheDocument();
    await expect(agent.queryByText('operator')).toBeNull();
    await expect(operator.getByText('candidate')).toBeInTheDocument();
    await expect(operator.getByText('operator')).toBeInTheDocument();
    await expect(operator.queryByText('extractor')).toBeNull();
  },
};
