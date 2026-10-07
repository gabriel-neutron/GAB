import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import type { GroupLine, GroupUnit, GroupUnits } from './groups';
import { GroupsPage } from './groups-page';
import { unitWords } from './unit-words';

// The rows the database declares for the one relation type and the one entity type of the sample.
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

const ARMY_GROUP = 'a1000000-0000-4000-8000-000000000001';

const LINES: readonly GroupLine[] = [
  {
    id: ARMY_GROUP,
    subject: '58th Combined Arms Army',
    proposer: 'v1_import',
    document: { id: 'doc_v1', title: 'Russian order of battle (v1 import)' },
    units: 104,
    clean: 101,
    faults: [
      { kind: 'end_waits', units: 1 },
      { kind: 'dispute', units: 1 },
      { kind: 'duplicate', units: 1 },
    ],
  },
  {
    id: 'a1000000-0000-4000-8000-000000000002',
    subject: 'Baltic Fleet',
    proposer: 'extractor',
    document: { id: 'doc_fleet', title: 'A report on the fleet with a long title of many words' },
    units: 12,
    clean: 12,
    faults: [],
  },
];

const unit = (id: string, name: string, extra: Partial<GroupUnit> = {}): GroupUnit => ({
  id,
  kind: 'entity',
  name,
  type: 'military_unit',
  state: 'clean',
  faults: [],
  entities: 1,
  relations: 1,
  parent: null,
  ...extra,
});

const ARMY = unit('u-army', '58th Combined Arms Army', {
  relations: 0,
  parent: { unit: null, name: 'Southern Military District' },
});
const DIVISION = unit('u-division', '42nd Guards Motor Rifle Division', {
  parent: { unit: 'u-army', name: '58th Combined Arms Army' },
});
const REGIMENT = unit('u-regiment', '70th Guards Motor Rifle Regiment', {
  parent: { unit: 'u-division', name: '42nd Guards Motor Rifle Division' },
});
const DISPUTED = unit('u-disputed', '19th Motor Rifle Division', {
  state: 'not_clean',
  faults: [{ kind: 'dispute', level: 'not_clean' }],
  parent: { unit: 'u-army', name: '58th Combined Arms Army' },
});
const LINK = unit('u-link', 'Army subordinate to the district', {
  kind: 'link',
  type: 'subordinate_to',
  state: 'blocked',
  faults: [{ kind: 'end_waits', level: 'blocks' }],
  entities: 0,
});

const GROUP: GroupUnits = {
  id: ARMY_GROUP,
  subject: '58th Combined Arms Army',
  units: [REGIMENT, DIVISION, ARMY, DISPUTED, LINK],
};

const onAct = fn();

const meta = {
  component: GroupsPage,
  args: {
    rail: { state: 'held', read: LINES },
    group: { state: 'held', group: GROUP, action: { step: 'idle' } },
    words: WORDS,
    onAct,
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-[720px] w-[1440px]">
      <GroupsPage {...args} />
    </div>
  ),
} satisfies Meta<typeof GroupsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each line of the rail names the subject, the proposer and the document, and counts the units,
 * the clean units and the units of each fault. */
export const TheRailCountsEachGroup: Story = {
  play: async ({ canvas }) => {
    const rail = canvas.getByRole('navigation', { name: 'Groups that wait for a decision' });
    await expect(within(rail).getByText('2 groups wait')).toBeVisible();
    const army = within(rail).getByRole('button', { name: /58th Combined Arms Army/u });
    await expect(army).toHaveAttribute('aria-current', 'true');
    await expect(within(army).getByText(/v1 import · Russian order of battle/u)).toBeVisible();
    await expect(within(army).getByText('104 units · 101 clean')).toBeVisible();
    await expect(within(army).getByText('waits: 1 · disputed: 1 · duplicate: 1')).toBeVisible();
    await userEvent.click(within(rail).getByRole('button', { name: /Baltic Fleet/u }));
    await expect(onAct).toHaveBeenCalledWith({
      kind: 'select',
      groupId: 'a1000000-0000-4000-8000-000000000002',
    });
  },
};

/** The confirmation says what the action writes and what stays, and it shows the tree of the
 * clean units. The action sends the clean units that the screen showed, a parent first. */
export const TheConfirmationShowsTheCountsAndTheTree: Story = {
  play: async ({ canvas }) => {
    onAct.mockClear();
    await userEvent.click(
      canvas.getByRole('button', { name: 'Promote the clean proposals of this group' }),
    );
    const confirm = canvas.getByRole('region', { name: 'Confirm the group action' });
    await expect(
      within(confirm).getByText(
        'Writes 3 entities and 2 relations of group 58th Combined Arms Army. 2 stay in the ' +
          'queue: 1 disputed, 0 with a fault, 1 waiting for another group. You cannot undo this.',
      ),
    ).toBeVisible();
    const tree = within(confirm).getByRole('list', { name: 'The tree of the clean units' });
    const lines = within(tree).getAllByRole('listitem');
    await expect(lines.map((line) => line.dataset['depth'])).toStrictEqual(['0', '1', '2']);
    await expect(lines[0]).toHaveTextContent(
      '58th Combined Arms ArmyMilitary unitunder Southern Military District',
    );
    await userEvent.click(within(confirm).getByRole('button', { name: 'Promote 3 units' }));
    await expect(onAct).toHaveBeenCalledWith({
      kind: 'promote',
      groupId: ARMY_GROUP,
      unitIds: ['u-army', 'u-division', 'u-regiment'],
    });
  },
};

/** The screen names each unit that the group action refused, and why. */
export const EachRefusedUnitIsNamed: Story = {
  args: {
    group: {
      state: 'held',
      group: GROUP,
      action: {
        step: 'done',
        groupId: ARMY_GROUP,
        results: [
          {
            unit: 'u-disputed',
            name: '19th Motor Rifle Division',
            outcome: 'refused',
            said: 'Not clean: Disputed: two readings',
          },
          { unit: 'u-army', name: '58th Combined Arms Army', outcome: 'promoted', said: null },
          { unit: 'u-division', name: '42nd Guards', outcome: 'promoted', said: null },
        ],
      },
    },
  },
  play: async ({ canvas }) => {
    const result = canvas.getByRole('region', { name: 'The result of the group action' });
    await expect(result).toHaveTextContent(
      'The record holds 2 units of the group action. 1 refused, and they stay in the queue:',
    );
    await expect(within(result).getByText(': Not clean: Disputed: two readings')).toBeVisible();
  },
};

/** At 900 px the rail and the group keep their names, and the tree scrolls in its own column. */
export const TheGroupsStayUsableAt900Px: Story = {
  render: (args) => (
    <div className="h-[600px] w-[900px]">
      <GroupsPage {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    const rail = canvas.getByRole('navigation', { name: 'Groups that wait for a decision' });
    await expect(rail.getBoundingClientRect().width).toBeGreaterThan(250);
    await expect(
      canvas.getByRole('heading', { name: '58th Combined Arms Army' }).getBoundingClientRect()
        .width,
    ).toBeGreaterThan(0);
    await userEvent.click(
      canvas.getByRole('button', { name: 'Promote the clean proposals of this group' }),
    );
    await expect(canvas.getByRole('region', { name: 'Confirm the group action' })).toBeVisible();
  },
};

/** A group with no clean unit says so, and its action is off. */
export const AGroupWithNoCleanUnitWritesNothing: Story = {
  args: {
    group: {
      state: 'held',
      group: { ...GROUP, units: [DISPUTED, LINK] },
      action: { step: 'idle' },
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('button', { name: 'Promote the clean proposals of this group' }),
    ).toBeDisabled();
    await expect(
      canvas.getByText(
        'No unit of group 58th Combined Arms Army is clean, so the action writes nothing. 2 ' +
          'stay in the queue: 1 disputed, 0 with a fault, 1 waiting for another group.',
      ),
    ).toBeVisible();
  },
};

/** When the action wrote every unit, the group waits no more, and its result stays on the
 * screen. */
export const TheResultStaysWhenTheGroupIsEmpty: Story = {
  args: {
    group: {
      state: 'private',
      groupId: ARMY_GROUP,
      why: 'The group cannot be read: no unit of this group waits',
      action: {
        step: 'done',
        groupId: ARMY_GROUP,
        results: [
          { unit: 'u-army', name: '58th Combined Arms Army', outcome: 'promoted', said: null },
        ],
      },
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('region', { name: 'The result of the group action' }),
    ).toHaveTextContent('The record holds 1 unit of the group action.');
    await expect(canvas.getByText(/no unit of this group waits/u)).toBeVisible();
  },
};
