import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, waitFor, within } from 'storybook/test';

import { NO_FILTER } from './review-workspace';
import { unitPageOf } from './unit-page';
import { ORPHAN_RELATION, SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';
import { unitWords } from './unit-words';
import { UnitsPage } from './units-page';

const page = unitPageOf(UNIT_ANSWER, null);
const units = page?.units ?? [];
const choices = page?.choices ?? { groups: [], documents: [], proposers: [] };
const NONE = { state: 'none' } as const;
const disputed = units.find((unit) => unit.id === SAMPLE_UNITS.disputed);
if (disputed === undefined) throw new Error('the sample holds no disputed unit');

const queueOf = (
  held: typeof units,
  counts: { matched?: number; before?: number; total?: number; filtered?: boolean } = {},
) => ({
  units: held,
  total: counts.total ?? 1082,
  matched: counts.matched ?? 1082,
  before: counts.before ?? 0,
  filtered: counts.filtered ?? false,
  more: 'ready' as const,
});

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
      queue: queueOf(units),
      filter: NO_FILTER,
      choices,
      linked: NONE,
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
      queue: queueOf(LONG),
      filter: NO_FILTER,
      choices,
      linked: NONE,
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

/** At 900 px the three columns stay, the names and the filters stay readable, and the list of
 * units still scrolls on its own. */
export const TheNamesStayAt900Pixels: Story = {
  args: {
    view: {
      state: 'held',
      queue: queueOf(LONG),
      filter: NO_FILTER,
      choices,
      linked: NONE,
      decision: { step: 'idle' },
    },
  },
  render: (args) => (
    <div className="h-[720px] w-[900px]">
      <UnitsPage {...args} />
    </div>
  ),
  play: async ({ canvas, canvasElement }) => {
    const changes = canvas.getByRole('region', { name: 'The changes of the unit' });
    await expect(changes.getBoundingClientRect().width).toBeGreaterThan(300);
    const [line] = canvas.getAllByRole('button', { name: /^5th Combined Arms Army/u });
    if (line === undefined) throw new Error('no line for the army');
    await expect(line.getBoundingClientRect().width).toBeGreaterThan(200);
    const filter = canvas.getByRole('form', { name: 'Filter the queue' });
    await expect(
      within(filter).getByLabelText('Fault').getBoundingClientRect().width,
    ).toBeGreaterThan(100);
    const list = canvas.getByRole('navigation', { name: 'Units that wait for a decision' });
    const scroller = list.querySelector('ul');
    if (scroller === null) throw new Error('the list has no scroller');
    await expect(getComputedStyle(scroller).overflowY).toBe('auto');
    await expect(scroller.scrollHeight).toBeGreaterThan(scroller.clientHeight);
    const page = canvasElement.querySelector('[data-units-page]');
    if (!(page instanceof HTMLElement)) throw new Error('no page');
    await expect(page.scrollHeight).toBe(page.clientHeight);
  },
};

/** Each filter is a plain control at the head of the list, and a change asks for the queue
 * again with the new filter. The name applies on Enter. */
export const EachFilterAsksForTheQueueAgain: Story = {
  play: async ({ canvas }) => {
    onAct.mockClear();
    const filter = canvas.getByRole('form', { name: 'Filter the queue' });
    await userEvent.selectOptions(within(filter).getByLabelText('Proposer'), 'extractor');
    await expect(onAct).toHaveBeenLastCalledWith({
      kind: 'filter',
      filter: { ...NO_FILTER, proposer: 'extractor' },
    });
    await userEvent.selectOptions(within(filter).getByLabelText('Fault'), 'dispute');
    await expect(onAct).toHaveBeenLastCalledWith({
      kind: 'filter',
      filter: { ...NO_FILTER, fault: 'dispute' },
    });
    await userEvent.selectOptions(
      within(filter).getByLabelText('Group'),
      'Southern Military District',
    );
    await expect(onAct).toHaveBeenLastCalledWith({
      kind: 'filter',
      filter: { ...NO_FILTER, group: '9a0c3c1e-5b7d-4e2f-8a61-2d4f6b8c0e13' },
    });
    await userEvent.selectOptions(
      within(filter).getByLabelText('Source document'),
      'Financial sanctions and the trade of Russia',
    );
    await expect(onAct).toHaveBeenLastCalledWith({
      kind: 'filter',
      filter: { ...NO_FILTER, document: 'doc_2852b6ae9b28' },
    });
    await userEvent.type(within(filter).getByLabelText('Name'), 'brigade{Enter}');
    await expect(onAct).toHaveBeenLastCalledWith({
      kind: 'filter',
      filter: { ...NO_FILTER, name: 'brigade' },
    });
  },
};

/** A filter that finds nothing says so, and does not say that the queue is empty. One click shows
 * every unit again. */
export const AFilterThatFindsNothingSaysSo: Story = {
  args: {
    view: {
      state: 'held',
      queue: { ...queueOf([], { matched: 0, filtered: true }), more: 'none' },
      filter: { ...NO_FILTER, fault: 'circle' },
      choices,
      linked: NONE,
      decision: { step: 'idle' },
    },
  },
  play: async ({ canvas }) => {
    onAct.mockClear();
    await expect(canvas.getByText('No unit matches this filter.')).toBeVisible();
    await expect(canvas.queryByText('The queue is empty.')).toBeNull();
    await expect(canvas.getByText('0 of 1082 units match the filter')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Show every unit' }));
    await expect(onAct).toHaveBeenCalledWith({ kind: 'filter', filter: NO_FILTER });
  },
};

/** An empty queue says that it is empty. */
export const AnEmptyQueueSaysSo: Story = {
  args: {
    view: {
      state: 'held',
      queue: { ...queueOf([], { matched: 0, total: 0 }), more: 'none' },
      filter: NO_FILTER,
      choices: { groups: [], documents: [], proposers: [] },
      linked: NONE,
      decision: { step: 'idle' },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The queue is empty.')).toBeVisible();
    await expect(canvas.queryByText('No unit matches this filter.')).toBeNull();
  },
};

/** After a reload the list starts at the place of the operator, says where it is, and can read
 * the queue again from its first unit. */
export const TheListStartsAtThePlaceOfTheOperator: Story = {
  args: {
    view: {
      state: 'held',
      queue: queueOf(units, { before: 100 }),
      filter: NO_FILTER,
      choices,
      linked: NONE,
      decision: { step: 'idle' },
    },
  },
  play: async ({ canvas }) => {
    onAct.mockClear();
    await expect(canvas.getByText('Units 101 to 109 of 1082')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Read from the first unit' }));
    await expect(onAct).toHaveBeenCalledWith({ kind: 'start' });
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
      said: 'Rejected the relation subordinate to → Eastern Military District: Not in the source.',
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
    await expect(lineOf(SAMPLE_UNITS.link)).toHaveTextContent('blocked: waits for another group');
    await expect(lineOf(SAMPLE_UNITS.disputed)).toHaveTextContent('not clean: disputed');
    // A wait in the same group stops only Promote of the unit alone, so the line does not mark it.
    await expect(lineOf(SAMPLE_UNITS.brigade)).toHaveTextContent(
      'approximate position · sources from the parent',
    );
    await expect(
      lineOf(SAMPLE_UNITS.brigade).querySelector('[data-fault="end_waits_in_group"]'),
    ).toBeNull();
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
      said: 'Rejected the relation subordinate to → 1061st Logistics Center: End rejected.',
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
      said:
        'Rejected the relation 1061st Logistics Center subordinate to → Eastern Military ' +
        'District: End rejected.',
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

/** A link to a unit that the pages read so far do not hold opens that unit, and Promote acts on
 * it. */
export const ALinkOpensAUnitThatIsNotOnThePage: Story = {
  args: {
    view: {
      state: 'held',
      queue: queueOf(units.filter((unit) => unit.id !== SAMPLE_UNITS.disputed)),
      filter: NO_FILTER,
      choices,
      linked: {
        state: 'held',
        unit: disputed,
      },
      decision: { step: 'idle' },
    },
    selectedId: SAMPLE_UNITS.disputed,
  },
  play: async ({ canvas }) => {
    onAct.mockClear();
    const changes = canvas.getByRole('region', { name: 'The changes of the unit' });
    await expect(
      within(changes).getByRole('heading', { name: 'North American countries' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Promote' }));
    await expect(onAct).toHaveBeenCalledWith({
      kind: 'decide',
      unitId: SAMPLE_UNITS.disputed,
      decision: { op: 'promote_unit', unitId: SAMPLE_UNITS.disputed },
      said: 'Promoted North American countries.',
    });
  },
};

/** A link to a unit that waits no more says so, and offers no Promote. */
export const ALinkToADecidedUnitSaysItIsNotInTheQueue: Story = {
  args: {
    view: {
      state: 'held',
      queue: queueOf(units),
      filter: NO_FILTER,
      choices,
      linked: { state: 'gone', unitId: 'c0ffee00-0000-4000-8000-000000000000' },
      decision: { step: 'idle' },
    },
    selectedId: 'c0ffee00-0000-4000-8000-000000000000',
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText(/This unit is not in the queue\./u)).toBeVisible();
    await expect(canvas.queryByRole('button', { name: 'Promote' })).toBeNull();
    await expect(canvasElement.querySelector('[aria-current="true"]')).toBeNull();
  },
};

/** After a decision, one line says what it did, over the next unit. */
export const ADoneDecisionSaysWhatItDid: Story = {
  args: {
    view: {
      state: 'held',
      queue: queueOf(units),
      filter: NO_FILTER,
      choices,
      linked: NONE,
      decision: {
        step: 'done',
        unitId: SAMPLE_UNITS.disputed,
        said: 'Promoted 5th Combined Arms Army and 1 relation.',
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'Promoted 5th Combined Arms Army and 1 relation.',
    );
  },
};

/** The name applies after a short pause in the typing, with no Enter. */
export const TheNameAppliesWhileTyping: Story = {
  play: async ({ canvas }) => {
    onAct.mockClear();
    const filter = canvas.getByRole('form', { name: 'Filter the queue' });
    await userEvent.type(within(filter).getByLabelText('Name'), 'arsenal');
    await waitFor(async () => {
      await expect(onAct).toHaveBeenLastCalledWith({
        kind: 'filter',
        filter: { ...NO_FILTER, name: 'arsenal' },
      });
    });
    await expect(onAct).toHaveBeenCalledOnce();
  },
};

/** The proposer offers only the proposers that have a unit in the queue. */
export const TheProposerOffersOnlyProposersWithUnits: Story = {
  play: async ({ canvas }) => {
    const filter = canvas.getByRole('form', { name: 'Filter the queue' });
    const options = [...within(filter).getByLabelText('Proposer').querySelectorAll('option')].map(
      (option) => option.textContent,
    );
    await expect(options).toStrictEqual(['Every proposer', 'extractor', 'v1 import']);
  },
};

/** The keys of the v1 import stand apart, after the other attributes, and each address of a list
 * is its own link. */
export const TheImportKeysStandApart: Story = {
  play: async ({ canvas }) => {
    const changes = canvas.getByRole('region', { name: 'The changes of the unit' });
    await expect(within(changes).getByRole('heading', { name: 'Import keys' })).toBeVisible();
    await expect(
      within(changes).getByRole('link', { name: 'voinskaya-chast-poisk.ru' }),
    ).toBeVisible();
    await expect(within(changes).getByRole('link', { name: 'ru.wikipedia.org' })).toBeVisible();
  },
};

/** An entity of an unknown type says so, and not "New unknown". */
export const AnUnknownTypeIsMarked: Story = {
  args: { selectedId: SAMPLE_UNITS.blockedMix },
  play: async ({ canvas }) => {
    const changes = canvas.getByRole('region', { name: 'The changes of the unit' });
    await expect(within(changes).getByText('Its type is unknown.')).toBeVisible();
    await expect(within(changes).queryByText(/New unknown/u)).toBeNull();
  },
};

/** An entity in the record with the same name is said before the click on Promote. */
export const ASecondEntityIsSaidBeforePromote: Story = {
  args: {
    view: {
      state: 'held',
      queue: queueOf(
        units.map((unit) =>
          unit.id === SAMPLE_UNITS.army
            ? {
                ...unit,
                state: 'not_clean' as const,
                faults: [
                  {
                    kind: 'duplicate' as const,
                    level: 'not_clean' as const,
                    act: null,
                    said:
                      'Same name and type under the same parent: 5th Combined Arms Army is in ' +
                      'the record',
                  },
                ],
              }
            : unit,
        ),
      ),
      filter: NO_FILTER,
      choices,
      linked: NONE,
      decision: { step: 'idle' },
    },
  },
  play: async ({ canvas }) => {
    const bar = canvas.getByRole('region', { name: 'The decision' });
    await expect(
      within(bar).getByText(
        /^A second 5th Combined Arms Army will be written; 5th Combined Arms Army is already in the record\./u,
      ),
    ).toBeVisible();
    await expect(within(bar).getByRole('button', { name: 'Promote' })).toBeEnabled();
  },
};
