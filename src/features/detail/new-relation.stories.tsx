import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fireEvent, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/fixtures/corpus';
import { vocabulary } from '@/shared/fixtures/vocabulary';

import { readDossier, type LinkChoices } from './dossier';
import { NewRelation } from './new-relation';

/** MV Northern Ledger, the entity the address names. It is always the source end. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

/** Meridian Bulk Carriers Ltd, the entity at the other end. */
const COMPANY = '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31';

const read = (): LinkChoices => {
  const held = readDossier(corpus, VESSEL, vocabulary);
  if (held === null) throw new Error('The committed corpus holds no MV Northern Ledger');
  return held.linkChoices;
};

const CHOICES = read();

const onCreate = fn();

const optionsOf = (root: HTMLElement): readonly string[] =>
  Array.from(root.querySelectorAll<HTMLOptionElement>('datalist option')).map(
    (option) => option.value,
  );

const meta = {
  component: NewRelation,
  args: { srcId: VESSEL, choices: CHOICES, busy: false, onCreate },
  parameters: { layout: 'fullscreen' },
  // The row holds four boxes and a button, so the width is fixed at 900px.
  render: (args) => (
    <div className="w-[900px] p-2">
      <NewRelation {...args} />
    </div>
  ),
} satisfies Meta<typeof NewRelation>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ABlankFormMakesNoRelation: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Make the relation' })).toBeDisabled();
    await expect(canvas.getByText('Write the type of the relation.')).toBeVisible();
  },
};

export const AnEndMustBeChosen: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Type'), 'owns');
    await expect(canvas.getByText('Choose the entity at the other end.')).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Make the relation' })).toBeDisabled();
  },
};

// The database holds the same five words in a check constraint, and refuses every other.
export const AnIntervalBelongsToFiveTypes: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByLabelText('Type'), 'berthed_at');
    await userEvent.selectOptions(canvas.getByLabelText('Other end'), COMPANY);
    await fireEvent.change(canvas.getByLabelText('From'), { target: { value: '2011-03-09' } });

    await expect(canvas.getByText(/An interval belongs to a relation of/)).toHaveTextContent(
      'owns, operates, flags, insures, appoints',
    );
    await expect(canvas.getByRole('button', { name: 'Make the relation' })).toBeDisabled();
  },
};

export const AReadyFormSendsOneAct: Story = {
  play: async ({ canvas }) => {
    onCreate.mockClear();
    await userEvent.type(canvas.getByLabelText('Type'), 'owns');
    await userEvent.selectOptions(canvas.getByLabelText('Other end'), COMPANY);
    await fireEvent.change(canvas.getByLabelText('From'), { target: { value: '2011-03-09' } });

    await userEvent.click(canvas.getByRole('button', { name: 'Make the relation' }));
    await expect(onCreate).toHaveBeenCalledWith({
      op: 'create_relation',
      type: 'owns',
      srcId: VESSEL,
      dstId: COMPANY,
      validFrom: '2011-03-09',
      validTo: null,
    });
  },
};

// The record holds no table of relation types, so the list is what the corpus already carries.
export const TheListOffersTheTypesOfTheCorpus: Story = {
  play: async ({ canvasElement }) => {
    const offered = optionsOf(canvasElement);
    await expect(offered).toContain('owns');
    await expect(offered).toContain('berthed_at');
    await expect(offered).toEqual([...CHOICES.types]);
  },
};

// One act at a time. A second relation written while one is in flight goes to a record that
// the first act has already moved.
export const AnActInFlightTakesNoEntry: Story = {
  args: { busy: true },
  play: async ({ canvas }) => {
    await expect(canvas.getByLabelText('Type')).toBeDisabled();
    await expect(canvas.getByLabelText('Other end')).toBeDisabled();
    await expect(canvas.getByLabelText('From')).toBeDisabled();
    await expect(canvas.getByLabelText('To')).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Make the relation' })).toBeDisabled();
  },
};
