import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { ChangeList } from './change-list';
import { unitPageOf } from './unit-page';
import { ORPHAN_RELATION, SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';
import { unitWords } from './unit-words';

const units = unitPageOf(UNIT_ANSWER, null)?.units ?? [];

const unitOf = (id: string) => units.find((unit) => unit.id === id) ?? null;

const CLOSING = '5d6e7f80-9a1b-4c2d-8e3f-4a5b6c7d8e9f';
const OWNS = '6e7f8091-a2b3-4c4d-9e5f-6a7b8c9d0e1f';

// The research AI gives the end date of an open relation of the record. The unit is that one act,
// and the read names the relation by its two ends.
const closing =
  unitPageOf(
    {
      ...UNIT_ANSWER,
      units: UNIT_ANSWER.units.slice(0, 1).map((unit) => ({
        ...unit,
        unit: CLOSING,
        kind: 'change',
        name: 'Rosneft owns Nayara',
        type: null,
        proposer: 'research_ai',
        group: null,
        faults: [],
        endRejected: null,
        acts: [
          {
            id: CLOSING,
            op: 'update_relation',
            payload: { valid_to: '2023-11-30' },
            targetId: OWNS,
            dissent: false,
            endRejected: false,
            dissentReason: null,
            check: null,
            target: { name: 'Rosneft owns Nayara', state: 'record', group: null },
            src: null,
            dst: null,
          },
        ],
        passages: [],
      })),
    },
    null,
  )?.units[0] ?? null;

const WORDS = unitWords(
  [
    {
      key: 'subordinate_to',
      label: 'subordinate to',
      inverseLabel: 'commands',
      takesInterval: true,
      retired: false,
    },
  ],
  [],
);

const onRelation = fn();

const meta = {
  component: ChangeList,
  args: { unit: unitOf(SAMPLE_UNITS.army), words: WORDS, aimed: null, onRelation },
  render: (args) => (
    <div className="flex h-[480px] w-[560px] flex-col border border-border">
      <ChangeList {...args} />
    </div>
  ),
} satisfies Meta<typeof ChangeList>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The entity comes first, each attribute as "key: value" in text, and no field. */
export const TheEntityComesFirstAsText: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: '5th Combined Arms Army' })).toBeVisible();
    await expect(canvas.getByText('echelon:')).toBeVisible();
    await expect(canvas.getByText('Army')).toBeVisible();
    await expect(canvas.queryByRole('textbox')).toBeNull();
  },
};

/** A long address is one link that names its host. */
export const ALongAddressIsOneLink: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'ru.wikipedia.org' });
    await expect(link.getAttribute('href')).toMatch(/^https:\/\/ru\.wikipedia\.org\/wiki\//u);
  },
};

/** A relation reads "word → name", and a relation to an entity of the record says so. */
export const ARelationToTheRecordSaysSo: Story = {
  play: async ({ canvasElement }) => {
    const line = canvasElement.querySelector('[data-relation]');
    await expect(line).toHaveTextContent(
      'subordinate to → Eastern Military District (in the record)',
    );
  },
};

/** A relation whose other end waits in the queue says so. */
export const ARelationToAWaitingEntitySaysSo: Story = {
  args: { unit: unitOf(SAMPLE_UNITS.brigade) },
  play: async ({ canvasElement }) => {
    const line = canvasElement.querySelector('[data-relation]');
    await expect(line).toHaveTextContent(
      'subordinate to → 5th Combined Arms Army (waits in the queue)',
    );
  },
};

/** A relation whose other end was rejected names that end and the day, and one action rejects
 * the relation with the reason "end rejected". */
export const ARelationToARejectedEndNamesItAndRejects: Story = {
  args: { unit: unitOf(SAMPLE_UNITS.orphan) },
  play: async ({ canvas, canvasElement }) => {
    onRelation.mockClear();
    const line = canvasElement.querySelector('[data-relation]');
    await expect(line).toHaveTextContent(
      'subordinate to → 1061st Logistics Center (the other end was rejected on 2026-10-07)',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reject this relation: end rejected' }),
    );
    await expect(onRelation).toHaveBeenCalledWith({
      kind: 'end_rejected',
      relationId: ORPHAN_RELATION,
    });
  },
};

/** A relation between two groups is a unit of its own, read from its source end. */
export const ALinkUnitReadsFromItsSource: Story = {
  args: { unit: unitOf(SAMPLE_UNITS.link) },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText(/A relation between two groups/u)).toBeVisible();
    const line = canvasElement.querySelector('[data-relation]');
    if (!(line instanceof HTMLElement)) throw new Error('no relation line');
    await expect(within(line).getByText('1061st Logistics Center')).toBeVisible();
  },
};

/** The column scrolls on its own when the unit is long. */
export const TheColumnScrollsOnItsOwn: Story = {
  render: (args) => (
    <div className="flex h-[160px] w-[560px] flex-col border border-border">
      <ChangeList {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const column = canvas.getByRole('region', { name: 'The changes of the unit' });
    await expect(column.scrollHeight).toBeGreaterThan(column.clientHeight);
  },
};

/** An act that gives the end date of an open relation reads "closes the relation on <date>", and
 * names the relation by its two ends. */
export const AnEndDateClosesTheRelation: Story = {
  args: { unit: closing },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByRole('heading', { name: 'End of a relation' })).toBeVisible();
    const change = canvasElement.querySelector(`[data-change="${CLOSING}"]`);
    await expect(change).toHaveTextContent(
      'Closes the relation on 2023-11-30: Rosneft owns Nayara.',
    );
    await expect(canvas.queryByText('valid to:')).toBeNull();
  },
};
