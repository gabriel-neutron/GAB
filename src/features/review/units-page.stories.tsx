import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { unitPageOf } from './unit-page';
import { ORPHAN_RELATION, SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';
import { unitWords } from './unit-words';
import { UnitsPage } from './units-page';

const units = unitPageOf(UNIT_ANSWER)?.units ?? [];

// The rows the database declares for the one relation type of the sample.
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
  [
    {
      key: 'military_unit',
      label: 'Military unit',
      colourLight: 'oklch(0.5 0.1 30)',
      colourDark: 'oklch(0.7 0.1 30)',
      retired: false,
    },
  ],
);

const onAct = fn();

// A long queue, so that each column holds more than one screen of lines.
const LONG = Array.from({ length: 30 }, (_, index) =>
  units.map((unit) => ({
    ...unit,
    id: `${unit.id.slice(0, -2)}${String(index).padStart(2, '0')}`,
  })),
).flat();

const meta = {
  component: UnitsPage,
  args: {
    view: {
      state: 'held',
      queue: { units, total: 1082, more: 'ready' },
      decision: { step: 'idle' },
    },
    selectedId: SAMPLE_UNITS.army,
    words: WORDS,
    onAct,
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-[720px] w-[1440px]">
      <UnitsPage {...args} />
    </div>
  ),
} satisfies Meta<typeof UnitsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Three columns: the units on the left, the changes of one unit in the middle, and why it waits
 * on the right. */
export const OneUnitIsReadInThreeColumns: Story = {
  play: async ({ canvas }) => {
    const list = canvas.getByRole('navigation', { name: 'Units that wait for a decision' });
    await expect(within(list).getAllByRole('button', { name: /group/u }).length).toBe(9);
    const changes = canvas.getByRole('region', { name: 'The changes of the unit' });
    await expect(
      within(changes).getByRole('heading', { name: '5th Combined Arms Army' }),
    ).toBeVisible();
    const why = canvas.getByRole('region', { name: 'The justification' });
    await expect(within(why).getByText('v1 import')).toBeVisible();
  },
};

/** A line names the unit, its type, its group and who proposed it, in words. */
export const ALineNamesTheUnitItsGroupAndItsProposer: Story = {
  play: async ({ canvasElement }) => {
    const line = canvasElement.querySelector(`[data-unit="${SAMPLE_UNITS.disputed}"]`);
    if (!(line instanceof HTMLElement)) throw new Error('no line for the disputed unit');
    await expect(line).toHaveTextContent('North American countries');
    await expect(line).toHaveTextContent('extractor');
    await expect(line).toHaveTextContent('no group');
    const army = canvasElement.querySelector(`[data-unit="${SAMPLE_UNITS.army}"]`);
    await expect(army).toHaveTextContent(
      'v1 import · Military unit · group 5th Combined Arms Army',
    );
    await expect(army).toHaveAttribute('aria-current', 'true');
  },
};

/** A click on a line opens that unit. */
export const AClickOpensTheUnit: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^North American countries/u }));
    await expect(onAct).toHaveBeenCalledWith({ kind: 'select', unitId: SAMPLE_UNITS.disputed });
  },
};

/** The next page is read on request, and the count says how much of the queue is read. */
export const TheNextPageIsReadOnRequest: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('9 of 1082 units read')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Read the next units' }));
    await expect(onAct).toHaveBeenCalledWith({ kind: 'more' });
  },
};

/** Each column scrolls on its own, and the page itself does not scroll. */
export const EachColumnScrollsOnItsOwn: Story = {
  args: {
    view: {
      state: 'held',
      queue: { units: LONG, total: 1082, more: 'ready' },
      decision: { step: 'idle' },
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const list = canvas.getByRole('navigation', { name: 'Units that wait for a decision' });
    const scroller = list.querySelector('ul');
    if (scroller === null) throw new Error('the list has no scroller');
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    scroller.scrollTop = 400;
    await expect(scroller.scrollTop).toBeGreaterThan(0);
    const page = canvasElement.querySelector('[data-units-page]');
    if (!(page instanceof HTMLElement)) throw new Error('no page');
    await expect(page.scrollHeight).toBe(page.clientHeight);
    const why = canvas.getByRole('region', { name: 'The justification' });
    await expect(getComputedStyle(why).overflowY).toBe('auto');
  },
};

/** At 900 px the three columns stay, and the names stay readable. */
export const TheNamesStayAt900Pixels: Story = {
  render: (args) => (
    <div className="h-[720px] w-[900px]">
      <UnitsPage {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const changes = canvas.getByRole('region', { name: 'The changes of the unit' });
    await expect(changes.getBoundingClientRect().width).toBeGreaterThan(300);
    const line = canvas.getByRole('button', { name: /^5th Combined Arms Army/u });
    await expect(line.getBoundingClientRect().width).toBeGreaterThan(200);
  },
};

/** With no write service, the page says why it holds no queue. */
export const WithNoWriterThePageSaysWhy: Story = {
  args: { view: { state: 'private', why: 'The queue is private.' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The queue is private.')).toBeVisible();
  },
};

/** The dark theme paints the same three columns. */
export const TheDarkThemePaintsTheColumns: Story = {
  render: (args) => (
    <div className="dark h-[720px] w-[1440px] bg-background text-foreground">
      <UnitsPage {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('region', { name: 'The justification' })).toBeVisible();
  },
};

/** One relation of the unit is rejected alone, with a reason, and the rest stays one unit. */
export const OneRelationIsRejectedAlone: Story = {
  play: async ({ canvas }) => {
    onAct.mockClear();
    await userEvent.click(canvas.getByRole('button', { name: 'Reject this relation' }));
    const bar = canvas.getByRole('region', { name: 'The decision' });
    await expect(
      within(bar).getByText(
        'Rejects the relation subordinate to → Eastern Military District. The rest of the unit ' +
          'stays in the queue.',
      ),
    ).toBeVisible();
    await userEvent.selectOptions(within(bar).getByLabelText('Reason'), 'not_in_source');
    await userEvent.click(within(bar).getByRole('button', { name: 'Reject the relation' }));
    await expect(onAct).toHaveBeenCalledWith({
      kind: 'decide',
      unitId: SAMPLE_UNITS.army,
      decision: {
        op: 'reject_relation',
        proposalId: '3f6a1c2e-0b9d-4e7f-a1c3-5d7e9f1a3b5c',
        reason: 'not_in_source',
      },
    });
    await userEvent.click(within(bar).getByRole('button', { name: 'Back to the unit' }));
    const unitBar = canvas.getByRole('region', { name: 'The decision' });
    await expect(within(unitBar).getByRole('button', { name: 'Promote' })).toBeVisible();
  },
};

/** Each line marks the faults of its unit in words: the state first, then one mark for each kind
 * of fault. A clean unit shows its information only. */
export const EachLineMarksItsFaults: Story = {
  play: async ({ canvasElement }) => {
    const lineOf = (id: string) => {
      const line = canvasElement.querySelector(`[data-unit="${id}"]`);
      if (!(line instanceof HTMLElement)) throw new Error(`no line for ${id}`);
      return line;
    };
    await expect(lineOf(SAMPLE_UNITS.link)).toHaveTextContent('blocked: waits');
    await expect(lineOf(SAMPLE_UNITS.disputed)).toHaveTextContent('not clean: disputed');
    await expect(lineOf(SAMPLE_UNITS.brigade)).toHaveTextContent(
      'parent first · approximate position · sources from the parent',
    );
    await expect(lineOf(SAMPLE_UNITS.army).querySelector('[data-fault]')).toBeNull();
    await expect(lineOf(SAMPLE_UNITS.blockedMix).querySelectorAll('[data-fault]')).toHaveLength(12);
  },
};

/** Promote is off on a blocked unit, and the right column says why. */
export const ABlockedUnitCannotBePromoted: Story = {
  args: { selectedId: SAMPLE_UNITS.link },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole('region', { name: 'The decision' });
    await expect(within(bar).getByRole('button', { name: 'Promote' })).toBeDisabled();
    const why = canvas.getByRole('region', { name: 'The justification' });
    await expect(
      within(why).getByText(
        'Waits for Southern Military District (group Southern Military District).',
      ),
    ).toBeVisible();
  },
};

/** A relation whose other end was rejected is rejected in one click, with the reason "end
 * rejected". */
export const ARelationToARejectedEndIsRejectedInOneClick: Story = {
  args: { selectedId: SAMPLE_UNITS.orphan },
  play: async ({ canvas }) => {
    onAct.mockClear();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reject this relation: end rejected' }),
    );
    await expect(onAct).toHaveBeenCalledWith({
      kind: 'decide',
      unitId: SAMPLE_UNITS.orphan,
      decision: { op: 'reject_relation', proposalId: ORPHAN_RELATION, reason: 'end_rejected' },
    });
  },
};

/** A link whose source end was rejected names that end, and one click rejects the link, which is
 * its whole unit. */
export const ALinkToARejectedSourceIsRejectedInOneClick: Story = {
  args: { selectedId: SAMPLE_UNITS.rejectedSource },
  play: async ({ canvas, canvasElement }) => {
    onAct.mockClear();
    await expect(canvasElement.querySelector('[data-relation]')).toHaveTextContent(
      '(1061st Logistics Center was rejected on 2026-10-07)',
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Reject this relation: end rejected' }),
    );
    await expect(onAct).toHaveBeenCalledWith({
      kind: 'decide',
      unitId: SAMPLE_UNITS.rejectedSource,
      decision: { op: 'reject_unit', unitId: SAMPLE_UNITS.rejectedSource, reason: 'end_rejected' },
    });
  },
};

/** Promote of a child alone waits for its parent in the same group, and the bar says so. */
export const PromoteOfAChildAloneWaitsForItsParent: Story = {
  args: { selectedId: SAMPLE_UNITS.brigade },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole('region', { name: 'The decision' });
    await expect(within(bar).getByRole('button', { name: 'Promote' })).toBeDisabled();
    await expect(
      within(bar).getByText(
        'Promote is not possible. Waits for 5th Combined Arms Army in this group: promote it ' +
          'first.',
      ),
    ).toBeVisible();
  },
};
