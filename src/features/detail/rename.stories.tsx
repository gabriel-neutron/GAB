import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { Rename, type RenameProps } from './rename';

const ENTITY = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const CHOICES: RenameProps['choices'] = [
  { key: 'company', name: 'Company' },
  { key: 'unknown', name: 'Unknown' },
  { key: 'vessel', name: 'Vessel' },
];

const onRename = fn();

const meta = {
  component: Rename,
  args: {
    entityId: ENTITY,
    stored: { label: 'MV Northern Ledger', type: 'unknown' },
    choices: CHOICES,
    busy: false,
    onRename,
  },
  beforeEach: () => {
    onRename.mockClear();
  },
  render: (args) => (
    <div className="w-[700px] p-2">
      <Rename {...args} />
    </div>
  ),
} satisfies Meta<typeof Rename>;

export default meta;

type Story = StoryObj<typeof meta>;

const SAVE = 'Save the name and the type';

export const TheFormOpensOnTheStoredNameAndType: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Entity name')).toHaveValue('MV Northern Ledger');
    await expect(canvas.getByLabelText('Entity type')).toHaveValue('unknown');
    await expect(canvas.getByRole('button', { name: SAVE })).toBeDisabled();
    await expect(canvas.getByText('Change the name or the type, and then save.')).toBeVisible();
  },
};

export const TheTypeIsChosenFromTheVocabulary: Story = {
  play: async ({ canvas }) => {
    const options = Array.from(
      canvas.getByLabelText('Entity type').querySelectorAll('option'),
      (option) => option.textContent,
    );
    await expect(options).toStrictEqual(['Company', 'Unknown', 'Vessel']);
  },
};

export const ANewTypeSendsOneActWithTheTypeAlone: Story = {
  play: async ({ canvas }) => {
    await userEvent.selectOptions(canvas.getByLabelText('Entity type'), 'vessel');
    await expect(canvas.getByText('Ready to save a new type.')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: SAVE }));

    await expect(onRename).toHaveBeenCalledTimes(1);
    await expect(onRename).toHaveBeenCalledWith({
      op: 'update_entity',
      targetId: ENTITY,
      label: null,
      type: 'vessel',
    });
  },
};

export const ABlankNameSendsNothing: Story = {
  play: async ({ canvas }) => {
    await userEvent.clear(canvas.getByLabelText('Entity name'));
    await expect(canvas.getByText('Write a name for the entity.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: SAVE })).toBeDisabled();
  },
};

export const AnActInFlightTakesNoSecondAct: Story = {
  args: { busy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Entity name')).toBeDisabled();
    await expect(canvas.getByLabelText('Entity type')).toBeDisabled();
    await expect(canvas.getByRole('button', { name: SAVE })).toBeDisabled();
  },
};
