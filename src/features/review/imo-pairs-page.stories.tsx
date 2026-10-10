import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, restoreAllMocks, spyOn, userEvent, waitFor, within } from 'storybook/test';

import type { ImoPair } from './imo-pairs';
import { ImoPairsPage } from './imo-pairs-page';

const RENAMED: ImoPair = {
  imo: '9482137',
  first: { id: '0b6f8f0e-2d1c-4a43-9a43-7d1f2b6c0a11', label: 'MV Northern Ledger' },
  second: { id: '5c2e9a7d-81f4-4b0e-b7a2-3e9d4c6f1b22', label: 'MV Arctic Ledger' },
};
const TWICE: ImoPair = {
  imo: '9613428',
  first: { id: '7a1d3c5e-9f2b-4d6a-8c0e-1b3d5f7a9c33', label: 'MV Kestrel Arrow' },
  second: { id: 'e4b6d8f0-a2c4-4e6a-9b8d-0f2a4c6e8b44', label: 'KESTREL ARROW' },
};

const PAIR_ROW = '[data-pair]';

const REFUSAL =
  'absorbedId: an act that waits names the absorbed entity, or a relation that the merge ' +
  'removes: decide it first, and then merge the two entities';

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
  component: ImoPairsPage,
  args: { read: { state: 'held', pairs: [RENAMED, TWICE] } },
  beforeEach: () => () => {
    restoreAllMocks();
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-[480px] w-full max-w-[1280px]">
      <ImoPairsPage {...args} />
    </div>
  ),
} satisfies Meta<typeof ImoPairsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each pair stands on one row with its IMO number, and the name and identifier of both vessels. */
export const EachPairShowsBothNamesAndIdentifiers: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole('region', { name: 'Vessels with the same IMO number' }),
    ).toBeVisible();
    const rows = [...canvasElement.querySelectorAll<HTMLElement>(PAIR_ROW)];
    await expect(rows).toHaveLength(2);
    const cells = rows.map((row) =>
      within(row)
        .getAllByRole('cell')
        .map((cell) => cell.textContent),
    );
    await expect(cells).toStrictEqual([
      [
        '9482137',
        `MV Northern Ledger${RENAMED.first.id}Keep this vessel`,
        `MV Arctic Ledger${RENAMED.second.id}Keep this vessel`,
      ],
      [
        '9613428',
        `MV Kestrel Arrow${TWICE.first.id}Keep this vessel`,
        `KESTREL ARROW${TWICE.second.id}Keep this vessel`,
      ],
    ]);
    await expect(
      canvas.getByRole('button', {
        name: 'Keep MV Arctic Ledger and merge MV Northern Ledger into it',
      }),
    ).toBeEnabled();
  },
};

/** With no pair, the page says so in one sentence. */
export const NoPairSaysSo: Story = {
  args: { read: { state: 'held', pairs: [] } },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('No two vessels of the record have the same IMO number.'),
    ).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

/** A merge keeps the vessel that the operator chose, keeps the other name as a former name, and
 * the pair leaves the list that the page reads again. */
export const AMergeTakesThePairOffTheList: Story = {
  play: async ({ canvas, canvasElement }) => {
    writerAnswers(
      {
        status: 200,
        body: { proposalId: 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e55', targetId: RENAMED.second.id },
      },
      { status: 200, body: { pairs: [TWICE] } },
    );
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Keep MV Arctic Ledger and merge MV Northern Ledger into it',
      }),
    );

    await waitFor(async () => {
      await expect(canvasElement.querySelectorAll(PAIR_ROW)).toHaveLength(1);
    });
    await expect(canvas.getByRole('status')).toHaveTextContent(
      '"MV Northern Ledger" was merged into "MV Arctic Ledger", and it is a former name of it now.',
    );
    await expect(asked).toStrictEqual([
      [
        '/write/merge-entities',
        JSON.stringify({
          survivorId: RENAMED.second.id,
          absorbedId: RENAMED.first.id,
          keepName: true,
        }),
      ],
      ['/private/imo-pairs', JSON.stringify({})],
    ]);
  },
};

/** A refused merge says the sentence of the writer, and the pair stays on the list. */
export const ARefusedMergeSaysWhy: Story = {
  play: async ({ canvas, canvasElement }) => {
    writerAnswers(
      { status: 422, body: { refusal: REFUSAL } },
      { status: 200, body: { pairs: [RENAMED, TWICE] } },
    );
    await userEvent.click(
      canvas.getByRole('button', { name: 'Keep MV Kestrel Arrow and merge KESTREL ARROW into it' }),
    );

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        `Nothing was written. ${REFUSAL}.`,
      );
    });
    await expect(canvasElement.querySelectorAll(PAIR_ROW)).toHaveLength(2);
  },
};

/** With no writer, the page says why it holds no pair. */
export const NoWriterSaysWhy: Story = {
  args: {
    read: {
      state: 'private',
      why: 'The pairs of vessels are private, and the write service on this machine did not give them. Start the write service, then open this page again.',
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/did not give them/u)).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};
