import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReactNode } from 'react';
import { expect, fn } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';

import { readDossier, type PendingLine, type RecordRow, type SourceRef } from './dossier';
import { SourceMark } from './mark';
import { Pending } from './pending';
import { EntityRecord } from './record';

/**
 * A candidate is never mixed into the record. No control can hide the labelling, and every
 * control stays disabled while the review queue is open. The tracker carries that queue.
 *
 * The input is `readDossier(corpus, …)`, which is what the page calls, so this file changes on
 * the day `src/contract/` replaces the fixtures. **Nothing here is invented.**
 */

/**
 * Maasvlakte bulk terminal, berth 7. Two pending proposals of the committed corpus name it: one
 * with dissent at 0.82, and one with no dissent at 0.41.
 */
const FACILITY = 'd41a7f38-2b90-4c15-8e6a-90f3b7c2d5e8';

const DOSSIER = readDossier(corpus, FACILITY);

const PROPOSALS: readonly PendingLine[] = DOSSIER?.pending ?? [];

/** The claims of the same entity, from the same read. They sit outside this section. */
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
  // A proposal is one row, and a row truncates. Each story states the width it is measured in.
  render: (args) => (
    <div className="w-[900px] p-2">
      <Pending {...args} />
    </div>
  ),
} satisfies Meta<typeof Pending>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The row is marked `candidate` in words. A hue alone gives nothing to a reader who cannot see
 * it, so the word is on every row.
 */
export const ACandidateIsMarkedInWords: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(rows(canvasElement)).toHaveLength(PROPOSALS.length);
    await expect(canvas.getAllByText('candidate')).toHaveLength(PROPOSALS.length);
  },
};

/**
 * The same words on the other ground. There is no theme decorator in `.storybook/preview.ts`,
 * so this story sets the class itself. A hue that holds on one ground does not hold on the
 * other, and the word must hold on both.
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

/**
 * Must not act. No accept, no reject, no promote: that is the review queue, and the tracker
 * carries it. The mark to the sources is the only control this section carries.
 */
export const NoControlActsOnAProposal: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.queryByRole('button', { name: /accept|reject|approve|promote/i }),
    ).toBeNull();
  },
};

/**
 * A candidate is drawn below the record and never mixed into it.
 *
 * **The defect this replaces:** the story mounted this section alone and compared the rows
 * inside its region to the rows inside the whole canvas. `Pending` draws one `<section>` and
 * every `[data-proposal]` is inside it by construction, so both sides were the same query and no
 * implementation could fail it — least of all one that put a candidate into the record, because
 * the record was not mounted.
 *
 * **The record is mounted beside this section now**, from the same dossier of the same entity.
 * `./record` is the same feature, so the import is permitted. The record draws a plain box, so
 * the story names the two regions itself, exactly as the page composes them.
 */
export const ACandidateIsNeverMixedIntoTheRecord: Story = {
  render: (args) => (
    <div className="w-[900px] p-2">
      <section aria-label="The record">
        <EntityRecord rows={CLAIMS} mark={mark} />
      </section>
      <Pending {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const record = canvas.getByRole('region', { name: 'The record' });
    const pending = canvas.getByRole('region', { name: 'Pending proposals' });

    // The record holds claims, so a candidate that landed among them would be found here.
    await expect(canvas.getAllByRole('region')).toHaveLength(2);
    await expect(record.querySelectorAll('[data-claim]').length).toBeGreaterThan(0);

    await expect(rows(record)).toHaveLength(0);
    await expect(rows(pending)).toHaveLength(PROPOSALS.length);
    await expect(rows(pending).length).toBeGreaterThan(0);
  },
};

/** The dissent and the confidence are written. `./dossier` formatted the figure. */
export const DissentAndConfidenceAreWritten: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('dissent')).toBeInTheDocument();
    await expect(canvas.getByText('no dissent')).toBeInTheDocument();
    await expect(canvas.getByText('0.82')).toBeInTheDocument();
    await expect(canvas.getByText('0.41')).toBeInTheDocument();
  },
};
