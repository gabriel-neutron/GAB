import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, restoreAllMocks, spyOn, userEvent, waitFor, within } from 'storybook/test';

import type { NameCandidate } from './name-candidates';
import { NameCandidatesPage } from './name-candidates-page';

const SHIPPER: NameCandidate = {
  key: 'sovkomflot',
  type: 'company',
  first: {
    id: '1a2b3c4d-0000-4a43-9a43-7d1f2b6c0a11',
    label: 'PJSC Sovcomflot',
    name: 'PJSC Sovcomflot',
  },
  second: {
    id: '5e6f7a8b-0000-4b0e-b7a2-3e9d4c6f1b22',
    label: 'ПАО «Совкомфлот»',
    name: 'ПАО «Совкомфлот»',
  },
};
const REFINERY: NameCandidate = {
  key: 'kirishinefteorgsintez',
  type: 'facility',
  first: {
    id: '0c1d2e3f-0000-4d6a-8c0e-1b3d5f7a9c33',
    label: 'KINEF refinery',
    name: 'Kirishinefteorgsintez',
  },
  second: {
    id: 'e4b6d8f0-0000-4e6a-9b8d-0f2a4c6e8b44',
    label: 'Киришинефтеоргсинтез',
    name: 'Киришинефтеоргсинтез',
  },
};

const PAIR_ROW = '[data-pair]';

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
  component: NameCandidatesPage,
  args: { read: { state: 'held', candidates: [SHIPPER, REFINERY] } },
  beforeEach: () => () => {
    restoreAllMocks();
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-[480px] w-full max-w-[1280px]">
      <NameCandidatesPage {...args} />
    </div>
  ),
} satisfies Meta<typeof NameCandidatesPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Each candidate stands on one row with its type, its key, and the label and identifier of both
 * entities. A name that matched and is not the label shows too. */
export const EachCandidateShowsBothLabelsTheKeyAndBothIdentifiers: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByRole('region', {
        name: 'Merge candidates across a Latin and a Cyrillic spelling',
      }),
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
        'company',
        'sovkomflot',
        `PJSC Sovcomflot${SHIPPER.first.id}Keep this entity`,
        `ПАО «Совкомфлот»${SHIPPER.second.id}Keep this entity`,
        'Refuse',
      ],
      [
        'facility',
        'kirishinefteorgsintez',
        `KINEF refineryMatched by the name Kirishinefteorgsintez${REFINERY.first.id}Keep this entity`,
        `Киришинефтеоргсинтез${REFINERY.second.id}Keep this entity`,
        'Refuse',
      ],
    ]);
    await expect(
      canvas.getByRole('button', {
        name: `Keep this entity, ПАО «Совкомфлот» (${SHIPPER.second.id}), and merge PJSC Sovcomflot into it`,
      }),
    ).toBeEnabled();
  },
};

/** With no candidate, the page says so in one sentence. */
export const NoCandidateSaysSo: Story = {
  args: { read: { state: 'held', candidates: [] } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/No pair of entities waits/u)).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};

/** A confirmation keeps the entity that the operator chose, the other label becomes a former
 * name, and the pair leaves the list that the page reads again. */
export const AConfirmationMergesThePair: Story = {
  play: async ({ canvas, canvasElement }) => {
    writerAnswers(
      {
        status: 200,
        body: { proposalId: 'f0e1d2c3-b4a5-4697-8879-6a5b4c3d2e55', targetId: SHIPPER.first.id },
      },
      { status: 200, body: { candidates: [REFINERY] } },
    );
    await userEvent.click(
      canvas.getByRole('button', {
        name: `Keep this entity, PJSC Sovcomflot (${SHIPPER.first.id}), and merge ПАО «Совкомфлот» into it`,
      }),
    );

    await waitFor(async () => {
      await expect(canvasElement.querySelectorAll(PAIR_ROW)).toHaveLength(1);
    });
    await expect(canvas.getByRole('status')).toHaveTextContent(
      '"ПАО «Совкомфлот»" was merged into "PJSC Sovcomflot", and it is a former name of it now.',
    );
    await expect(asked).toStrictEqual([
      [
        '/write/confirm-name-candidate',
        JSON.stringify({ survivorId: SHIPPER.first.id, absorbedId: SHIPPER.second.id }),
      ],
      ['/private/name-candidates', JSON.stringify({})],
    ]);
  },
};

/** A refusal takes the pair off the list, and the page says that it does not come back. */
export const ARefusalTakesThePairOff: Story = {
  play: async ({ canvas, canvasElement }) => {
    writerAnswers(
      { status: 200, body: { refused: 1 } },
      { status: 200, body: { candidates: [SHIPPER] } },
    );
    await userEvent.click(
      canvas.getByRole('button', {
        name: 'Refuse the pair KINEF refinery and Киришинефтеоргсинтез',
      }),
    );

    await waitFor(async () => {
      await expect(canvasElement.querySelectorAll(PAIR_ROW)).toHaveLength(1);
    });
    await expect(canvas.getByRole('status')).toHaveTextContent(
      'The pair "KINEF refinery" and "Киришинефтеоргсинтез" was refused, and it does not come back.',
    );
    await expect(asked).toStrictEqual([
      [
        '/write/refuse-name-candidate',
        JSON.stringify({ firstId: REFINERY.first.id, secondId: REFINERY.second.id }),
      ],
      ['/private/name-candidates', JSON.stringify({})],
    ]);
  },
};

/** A refused confirmation says the sentence of the writer with no name of a field, and the pair
 * stays on the list. */
export const ARefusedConfirmationSaysWhy: Story = {
  play: async ({ canvas, canvasElement }) => {
    const refusal =
      'an act that waits names the absorbed entity, or a relation that the merge removes: ' +
      'decide it first, and then merge the two entities';
    writerAnswers(
      { status: 422, body: { refusal: `absorbedId: ${refusal}` } },
      { status: 200, body: { candidates: [SHIPPER, REFINERY] } },
    );
    await userEvent.click(
      canvas.getByRole('button', {
        name: `Keep this entity, KINEF refinery (${REFINERY.first.id}), and merge Киришинефтеоргсинтез into it`,
      }),
    );

    await waitFor(async () => {
      await expect(canvas.getByRole('status')).toHaveTextContent(
        `Nothing was written. ${refusal}.`,
      );
    });
    await expect(canvasElement.querySelectorAll(PAIR_ROW)).toHaveLength(2);
  },
};

/** With no writer, the page says why it holds no candidate. */
export const NoWriterSaysWhy: Story = {
  args: {
    read: {
      state: 'private',
      why: 'The merge candidates are private, and the write service on this machine did not give them. Start the write service, then open this page again.',
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/did not give them/u)).toBeVisible();
    await expect(canvas.queryByRole('table')).toBeNull();
  },
};
