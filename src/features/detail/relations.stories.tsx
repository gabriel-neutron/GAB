import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';

import { readDossier, type RelationLine } from './dossier';
import { SourceMark } from './mark';
import { Relations } from './relations';

/** M4: a relation carries `src_kind` and `dst_kind`, for deferred reification. */

/** Meridian Bulk Carriers Ltd. From this end the `contradicts` relation is a **direct** one. */
const COMPANY = '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31';

/** MV Northern Ledger. From this end the same relation points at a direct relation. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

/** The M4 relation: its other endpoint is the `owns` relation, and no graph draws it. */
const M4 = 'd4e5f60a-1b2c-4234-d567-e8f90a1b2c3d';

/** An ordinary relation of the company, with a closed interval. */
const APPOINTS = 'a2b3c4d5-8e9f-4012-b345-c6d7e8f90a1b';

const relationsOf = (entityId: string): readonly RelationLine[] =>
  readDossier(corpus, entityId)?.relations ?? [];

const FROM_ENTITY_END = relationsOf(COMPANY);
const FROM_RELATION_END = relationsOf(VESSEL);

const lineOf = (relations: readonly RelationLine[], id: string): RelationLine => {
  const held = relations.find((relation) => relation.id === id);
  if (held === undefined) throw new Error('The committed corpus does not reach this relation here');
  return held;
};

const NOT_DRAWN = /the graph does not draw this relation/i;

const rowOf = (root: HTMLElement, id: string): HTMLElement => {
  const found = root.querySelector<HTMLElement>(`[data-relation="${id}"]`);
  if (found === null) throw new Error('No line carries this relation');
  return found;
};

const rows = (root: HTMLElement): readonly HTMLElement[] =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-relation]'));

const onSelectSource = fn();

const meta = {
  component: Relations,
  args: {
    relations: FROM_ENTITY_END,
    mark: (sources) => (
      <SourceMark sources={sources} activeSource={null} onSelectSource={onSelectSource} />
    ),
  },
  parameters: { layout: 'fullscreen' },
  // A relation is one line, and a line truncates, so the width is fixed at 900px.
  render: (args) => (
    <div className="w-[900px] p-2">
      <Relations {...args} />
    </div>
  ),
} satisfies Meta<typeof Relations>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheM4RelationIsReachableFromTheRelationEnd: Story = {
  args: { relations: FROM_RELATION_END },
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement, M4);
    await expect(row).toHaveTextContent(lineOf(FROM_RELATION_END, M4).sentence);
    await expect(row).toHaveTextContent(NOT_DRAWN);
  },
};

export const TheM4RelationIsReachableFromTheEntityEnd: Story = {
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement, M4);
    await expect(row).toHaveTextContent(lineOf(FROM_ENTITY_END, M4).sentence);
    await expect(row).toHaveTextContent(NOT_DRAWN);
    // The sentence of a relation is a property of the relation, so both ends read the same one.
    await expect(lineOf(FROM_ENTITY_END, M4).sentence).toBe(lineOf(FROM_RELATION_END, M4).sentence);
  },
};

export const AnOrdinaryRelationCarriesNoUndrawableMark: Story = {
  play: async ({ canvasElement }) => {
    await expect(lineOf(FROM_ENTITY_END, APPOINTS).undrawable).toBe(false);
    await expect(rowOf(canvasElement, APPOINTS)).not.toHaveTextContent(NOT_DRAWN);
  },
};

/** M6: an interval is written at both ends, and a closed interval never reads as current. */
export const AClosedIntervalIsWrittenAtBothEnds: Story = {
  play: async ({ canvasElement }) => {
    const row = rowOf(canvasElement, APPOINTS);
    await expect(row).toHaveTextContent('2011-03-09');
    await expect(row).toHaveTextContent('2024-11-30');
    await expect(row).toHaveTextContent(/closed/);
  },
};

export const EveryRelationNamesItsSources: Story = {
  play: async ({ canvasElement }) => {
    const lines = rows(canvasElement);
    await expect(lines.length).toBeGreaterThan(0);
    const marked = lines.filter((line) => line.querySelector('button') !== null);
    await expect(marked).toHaveLength(lines.length);
  },
};
