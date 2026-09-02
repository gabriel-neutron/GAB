import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, restoreAllMocks, spyOn, userEvent, waitFor, within } from 'storybook/test';

import { CreateEntityDialog } from './create-entity-dialog';

const PROPOSAL = 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12';
const MADE = '0d8c4b31-77aa-4f0e-9d21-58b6e0c4a119';

const SIGNED = { state: 'signed', proposalId: PROPOSAL, targetId: MADE };

const onCreated = fn(() => Promise.resolve());
const onOpenEntity = fn();

/** The write door of the browser, answered by the story, so no story reaches the writer. The
 * answer is held until `open` runs, so the act in flight can be read on the screen. */
const doorHolding = (body: unknown): { readonly open: () => void } => {
  let open = (): void => undefined;
  const answered = new Promise<void>((settle) => {
    open = () => {
      settle();
    };
  });
  spyOn(globalThis, 'fetch').mockImplementation(async () => {
    await answered;
    return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
  });
  return { open };
};

const doorAnswering = (body: unknown): void => {
  doorHolding(body).open();
};

// The dialog is portalled to the body, so its content stands outside the canvas element.
const panel = () => within(document.body);

const openIt = async (): Promise<void> => {
  await userEvent.click(within(document.body).getByRole('button', { name: 'New entity' }));
};

const meta = {
  component: CreateEntityDialog,
  args: { onCreated, onOpenEntity },
  // A story that takes the door gives it back, so a play that fails leaves no stub behind.
  beforeEach: () => () => {
    restoreAllMocks();
  },
} satisfies Meta<typeof CreateEntityDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ABlankFormMakesNoEntity: Story = {
  play: async () => {
    await openIt();
    await expect(panel().getByRole('button', { name: 'Create' })).toBeDisabled();
    await expect(panel().getByRole('status')).toHaveTextContent(
      'Write the type of the entity, and the name it stands under.',
    );
  },
};

export const ATypeWithNoNameMakesNoEntity: Story = {
  play: async () => {
    await openIt();
    await userEvent.type(panel().getByLabelText('Type'), 'warehouse');
    await expect(panel().getByRole('status')).toHaveTextContent(
      'Write the name the entity stands under.',
    );
    await expect(panel().getByRole('button', { name: 'Create' })).toBeDisabled();
  },
};

// A type the record does not hold is taken and never refused, and the word keeps its place.
export const AnUnknownTypeIsTakenInWords: Story = {
  play: async () => {
    await openIt();
    await userEvent.type(panel().getByLabelText('Type'), 'warehouse');
    await userEvent.type(panel().getByLabelText('Name'), 'Pier 9 shed');
    await expect(panel().getByRole('status')).toHaveTextContent('stands as unknown');
    await expect(panel().getByRole('button', { name: 'Create' })).toBeEnabled();
  },
};

// One act on the screen, two things in the record: the proposal, and the entity it promoted.
export const ASignedEntityNamesItsProposal: Story = {
  play: async () => {
    doorAnswering(SIGNED);
    onOpenEntity.mockClear();
    await openIt();
    await userEvent.type(panel().getByLabelText('Type'), 'warehouse');
    await userEvent.type(panel().getByLabelText('Name'), 'Pier 9 shed');
    await userEvent.click(panel().getByRole('button', { name: 'Create' }));

    await waitFor(async () => {
      await expect(panel().getByRole('status')).toHaveTextContent(PROPOSAL);
    });

    await userEvent.click(panel().getByRole('button', { name: 'Open the new entity' }));
    await expect(onOpenEntity).toHaveBeenCalledWith(MADE);
  },
};

export const ARefusalWritesNothing: Story = {
  play: async () => {
    doorAnswering({ refusal: 'type: the value is blank' });
    await openIt();
    await userEvent.type(panel().getByLabelText('Type'), 'warehouse');
    await userEvent.type(panel().getByLabelText('Name'), 'Pier 9 shed');
    await userEvent.click(panel().getByRole('button', { name: 'Create' }));

    await waitFor(async () => {
      await expect(panel().getByRole('status')).toHaveTextContent('Nothing was written.');
    });
    await expect(panel().queryByRole('button', { name: 'Open the new entity' })).toBeNull();
  },
};

// A second click while one act is in flight writes a second entity, and the record then holds
// two entities that stand for one thing.
export const AnActInFlightTakesNoEntry: Story = {
  play: async () => {
    const door = doorHolding(SIGNED);
    await openIt();
    await userEvent.type(panel().getByLabelText('Type'), 'warehouse');
    await userEvent.type(panel().getByLabelText('Name'), 'Pier 9 shed');
    await userEvent.click(panel().getByRole('button', { name: 'Create' }));

    await expect(panel().getByRole('status')).toHaveTextContent(
      'The new entity is going to the record.',
    );
    await expect(panel().getByRole('button', { name: 'Create' })).toBeDisabled();
    await expect(panel().getByLabelText('Type')).toBeDisabled();
    await expect(panel().getByLabelText('Name')).toBeDisabled();

    door.open();
    await waitFor(async () => {
      await expect(panel().getByRole('status')).toHaveTextContent(PROPOSAL);
    });
  },
};
