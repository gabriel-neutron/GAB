import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, restoreAllMocks, spyOn, userEvent, waitFor, within } from 'storybook/test';

import type { WaitingName } from './author-names';
import { NamesPage } from './names-page';

const MOD: WaitingName = {
  name: 'ministry of defence of ukraine',
  author: 'ministry of defence',
  letter: 'A',
  units: 3,
};
const OFAC: WaitingName = {
  name: 'ofac',
  author: 'office of foreign assets control',
  letter: 'B',
  units: 1,
};

interface Reply {
  readonly status: number;
  readonly body: unknown;
}

const asked: unknown[] = [];

// The story has no writer: the doors answer from here in turn, and a Response body is read once,
// so each answer is new.
const writerAnswers = (...replies: readonly Reply[]): void => {
  asked.length = 0;
  let next = 0;
  spyOn(globalThis, 'fetch').mockImplementation((address, init) => {
    asked.push([address, init?.body]);
    const reply = replies[Math.min(next, replies.length - 1)];
    next += 1;
    return Promise.resolve(
      new Response(JSON.stringify(reply?.body), {
        status: reply?.status ?? 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  });
};

const meta = {
  component: NamesPage,
  args: { read: { state: 'held', names: [MOD, OFAC] } },
  beforeEach: () => () => {
    restoreAllMocks();
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-[480px] w-[1280px]">
      <NamesPage {...args} />
    </div>
  ),
} satisfies Meta<typeof NamesPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each name stands on one row with its author, the letter of the author and its units. */
export const EachNameShowsItsAuthorLetterAndUnits: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole('region', { name: 'Names that joined an author A or B' }),
    ).toBeVisible();
    const rows = [...canvasElement.querySelectorAll<HTMLElement>('[data-name]')];
    await expect(rows).toHaveLength(2);
    const cells = rows.map((row) =>
      within(row)
        .getAllByRole('cell')
        .slice(0, 4)
        .map((cell) => cell.textContent),
    );
    await expect(cells).toStrictEqual([
      ['ministry of defence of ukraine', 'ministry of defence', 'A', '3'],
      ['ofac', 'office of foreign assets control', 'B', '1'],
    ]);
    await expect(canvas.getByRole('button', { name: 'Confirm ofac' })).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Refuse ofac' })).toBeEnabled();
  },
};

/** A confirmation calls the writer, and the page reads the list again. */
export const AConfirmationReadsTheListAgain: Story = {
  play: async ({ canvas, canvasElement }) => {
    writerAnswers({ status: 200, body: { units: 3 } }, { status: 200, body: { names: [OFAC] } });
    await userEvent.click(canvas.getByRole('button', { name: `Confirm ${MOD.name}` }));

    await waitFor(async () => {
      await expect(canvasElement.querySelectorAll('[data-name]')).toHaveLength(1);
    });
    await expect(canvas.getByRole('status')).toHaveTextContent(
      `"${MOD.name}" was confirmed. The rules decided 3 units again.`,
    );
    await expect(asked).toStrictEqual([
      ['/write/decide-author-name', JSON.stringify({ name: MOD.name, confirm: true })],
      ['/private/author-names', JSON.stringify({})],
    ]);
  },
};

/** A refusal calls the writer with the choice to refuse, and the page reads the list again. */
export const ARefusalReadsTheListAgain: Story = {
  play: async ({ canvas }) => {
    writerAnswers({ status: 200, body: { units: 1 } }, { status: 200, body: { names: [] } });
    await userEvent.click(canvas.getByRole('button', { name: 'Refuse ofac' }));

    await waitFor(async () => {
      await expect(canvas.getByText('No name waits for a decision.')).toBeVisible();
    });
    await expect(canvas.getByRole('status')).toHaveTextContent(
      '"ofac" was refused. The rules decided 1 unit again.',
    );
    await expect(asked[0]).toStrictEqual([
      '/write/decide-author-name',
      JSON.stringify({ name: 'ofac', confirm: false }),
    ]);
  },
};

/** A refused decision says the sentence of the writer, and the list stays as the record holds it. */
export const ARefusedDecisionSaysWhy: Story = {
  play: async ({ canvas, canvasElement }) => {
    writerAnswers(
      { status: 422, body: { refusal: 'the name "ofac" waits for no decision' } },
      { status: 200, body: { names: [MOD, OFAC] } },
    );
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm ofac' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        'Nothing was written. the name "ofac" waits for no decision.',
      );
    });
    await expect(canvasElement.querySelectorAll('[data-name]')).toHaveLength(2);
  },
};

/** The buttons stay disabled until the list is read again after a decision. */
export const TheButtonsWaitForTheListReadAgain: Story = {
  play: async ({ canvas }) => {
    let readAgain = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      readAgain = resolve;
    });
    spyOn(globalThis, 'fetch').mockImplementation(async (address) => {
      if (address === '/private/author-names') await held;
      const body = address === '/private/author-names' ? { names: [OFAC] } : { units: 3 };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    await userEvent.click(canvas.getByRole('button', { name: `Confirm ${MOD.name}` }));

    await expect(canvas.getByRole('button', { name: 'Refuse ofac' })).toBeDisabled();
    await expect(canvas.getByRole('status')).toHaveTextContent(`Confirming "${MOD.name}".`);
    readAgain();
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: 'Refuse ofac' })).toBeEnabled();
    });
    await expect(canvas.queryByRole('button', { name: `Confirm ${MOD.name}` })).toBeNull();
  },
};

/** When the writer stops after a decision, the page still says what the decision did. */
export const AWriterLostAfterADecisionKeepsTheResult: Story = {
  play: async ({ canvas }) => {
    writerAnswers({ status: 200, body: { units: 1 } }, { status: 503, body: {} });
    await userEvent.click(canvas.getByRole('button', { name: 'Refuse ofac' }));

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        '"ofac" was refused. The rules decided 1 unit again.',
      );
    });
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

/** With no writer, the page says why it holds no name. */
export const NoWriterSaysWhy: Story = {
  args: {
    read: {
      state: 'private',
      why: 'The names that wait are private, and the write service on this machine did not give them. Start the write service, then open this page again.',
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/did not give them/u)).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};
