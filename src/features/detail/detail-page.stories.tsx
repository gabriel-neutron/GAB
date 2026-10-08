import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  expect,
  fireEvent,
  fn,
  restoreAllMocks,
  spyOn,
  userEvent,
  waitFor,
  within,
} from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

import { DetailPage } from './detail-page';
import { readDossier, type Dossier, type RelationLine, type SourceCardModel } from './dossier';
import type { DecidedAct } from '@/shared/read/decided-acts';

// A lint gate refuses a page story that mounts a live canvas. This page mounts none.
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const read = (): Dossier => {
  const held = readDossier(corpus, VESSEL, entityTypes, []);
  if (held === null) throw new Error('The committed corpus holds no MV Northern Ledger');
  return held;
};

const DOSSIER = read();

const firstCard = (): SourceCardModel => {
  const held = DOSSIER.sources[0];
  if (held === undefined) throw new Error('The dossier carries no card');
  return held;
};

const CARD = firstCard();

const MARK_NAME = `Source ${CARD.number} — ${CARD.title}`;

const railOf = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('complementary', { name: 'Sources' });

const recordPaneOf = (root: HTMLElement): HTMLElement => {
  const pane = root.querySelector<HTMLElement>('[data-pane="record"]');
  if (pane === null) throw new Error('The page draws no record pane');
  return pane;
};

const knock = fn<(address: string, body: unknown) => void>();

const addressOf = (input: RequestInfo | URL): string => {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
};

const bodyOf = (init: RequestInit | undefined): unknown => {
  if (typeof init?.body !== 'string') return undefined;
  const parsed: unknown = JSON.parse(init.body);
  return parsed;
};

/** The write door of the browser, answered by the story. The answer is held until `open` runs,
 * so the analyst can act while one act is in flight. */
const doorGiving = (reply: () => Response): { readonly open: () => void } => {
  let open = (): void => undefined;
  const answered = new Promise<void>((settle) => {
    open = () => {
      settle();
    };
  });
  spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    knock(addressOf(input), bodyOf(init));
    await answered;
    return reply();
  });
  return { open };
};

const PROPOSAL = 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12';

type WriterSays =
  | { readonly said: 'signed' }
  | { readonly said: 'refused'; readonly refusal: string }
  | { readonly said: 'doubt' };

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// The statuses are the ones the writer routes give each outcome.
const answerOf = (says: WriterSays): Response => {
  switch (says.said) {
    case 'signed':
      return json(200, { state: 'signed', proposalId: PROPOSAL, targetId: VESSEL });
    case 'refused':
      return json(422, { refusal: says.refusal });
    case 'doubt':
      return json(502, { doubt: 'the record gave no answer to read' });
  }
};

const doorAnswering = (says: WriterSays): { readonly open: () => void } =>
  doorGiving(() => answerOf(says));

// The shape a dropped connection takes in the browser: the request left, and no answer came.
const NO_ANSWER = (): Response => {
  throw new TypeError('Failed to fetch');
};

const GATEWAY_TIMEOUT = (): Response => new Response('<html>504</html>', { status: 504 });

const SIGNED: WriterSays = { said: 'signed' };

const BREAKS_A_SHAPE_RULE = 'the act breaks a rule the record holds on its shape';

const HULL_NOTE = 'Repainted funnel, photographed 2026-05';

const saidIn = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('status', { name: 'The saving of the claims' });

const shapeSaidIn = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('status', { name: 'The shape of the record' });

const shapeAlarmIn = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('alert', { name: 'The shape of the record' });

const saveAlarmIn = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('alert', { name: 'The saving of the claims' });

const onDeleted = fn(() => Promise.resolve());

const onSaved = fn(() => Promise.resolve());

/** A reload of the record that lands only when `land` runs. */
const reloadHeld = (): { readonly land: () => void } => {
  let land = (): void => undefined;
  const landed = new Promise<void>((settle) => {
    land = () => {
      settle();
    };
  });
  onSaved.mockImplementationOnce(() => landed);
  return { land };
};

const firstRelation = (): RelationLine => {
  const held = DOSSIER.relations[0];
  if (held === undefined) throw new Error('The vessel carries no relation');
  return held;
};

const RELATION = firstRelation().sentence;

const RELATION_ID = firstRelation().id;

const toggleView = async (root: HTMLElement): Promise<void> => {
  await userEvent.click(within(root).getByRole('button', { name: 'Edit' }));
};

const askToDelete = async (root: HTMLElement, name: string): Promise<void> => {
  await userEvent.click(within(root).getByRole('button', { name: `Delete ${name}` }));
  await userEvent.click(
    within(root).getByRole('button', { name: `Confirm the deletion of ${name}` }),
  );
};

const meta = {
  component: DetailPage,
  args: {
    dossier: DOSSIER,
    arrivedAtSource: null,
    onSaved,
    onDeleted,
  },
  parameters: { layout: 'fullscreen' },
  // A story that takes the door gives it back, so a play that fails leaves no stub behind.
  beforeEach: () => () => {
    knock.mockClear();
    onDeleted.mockClear();
    onSaved.mockClear();
    restoreAllMocks();
  },
} satisfies Meta<typeof DetailPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheRecordAndTheSourcesStandInSeparatePanes: Story = {
  play: async ({ canvasElement }) => {
    const rail = railOf(canvasElement);
    const record = recordPaneOf(canvasElement);

    await expect(record).not.toBe(rail);
    await expect(record.contains(rail)).toBe(false);
    await expect(rail.contains(record)).toBe(false);
    await expect(record.querySelector('[data-claim]')).not.toBeNull();
  },
};

export const AMarkInTheRecordMarksTheCardInTheRail: Story = {
  play: async ({ canvasElement }) => {
    const rail = railOf(canvasElement);

    await expect(rail.querySelector('[aria-current="true"]')).toBeNull();

    const first = within(canvasElement).getAllByRole('button', { name: MARK_NAME })[0];
    if (first === undefined) throw new Error('No mark carries the name of source 1');
    await userEvent.click(first);

    await expect(rail.querySelector('[aria-current="true"]')).toHaveTextContent(CARD.title);
    await expect(first).toHaveAttribute('aria-pressed', 'true');
  },
};

export const ArrivingWithASourceMarksThatCard: Story = {
  args: { arrivedAtSource: CARD.id },
  play: async ({ canvasElement }) => {
    const marked = railOf(canvasElement).querySelector('[aria-current="true"]');
    await expect(marked).toHaveTextContent(CARD.title);
  },
};

export const NoPlaceholderProseIsDrawn: Story = {
  play: async ({ canvasElement }) => {
    const words = canvasElement.textContent;
    await expect(words).not.toMatch(/Placeholder words/);
    await expect(words).not.toMatch(/Promoted by proposal/);
  },
};

export const TheEntityNamesItsOwnSources: Story = {
  play: async ({ canvas }) => {
    const part = canvas.getByRole('region', {
      name: 'Sources of the name, the type and the map location',
    });

    await expect(DOSSIER.entitySources.length).toBeGreaterThan(0);
    for (const source of DOSSIER.entitySources) {
      await expect(within(part).getByRole('button', { name: source.name })).toBeVisible();
    }
  },
};

/** The company of the committed corpus. It carries no geometry, so the map draws no point. */
const COMPANY = '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31';

const readCompany = (): Dossier => {
  const held = readDossier(corpus, COMPANY, entityTypes, []);
  if (held === null) throw new Error('The committed corpus holds no Meridian Bulk Carriers');
  return held;
};

export const TheEntityIsReachedOnBothCanvases: Story = {
  play: async ({ canvas }) => {
    await expect(DOSSIER.drawnOnMap).toBe(true);

    const graph = canvas.getByRole('link', { name: 'Show on the graph' });
    await expect(graph).toHaveAttribute('href', `/graph?entity=${DOSSIER.entityId}`);

    const map = canvas.getByRole('link', { name: 'Show on the map' });
    await expect(map).toHaveAttribute('href', `/map?entity=${DOSSIER.entityId}`);
  },
};

/** A link that opens a surface which then selects nothing states a position the record lacks. */
export const AnEntityOffTheMapIsReachedOnTheGraphOnly: Story = {
  args: { dossier: readCompany() },
  play: async ({ canvas }) => {
    await expect(readCompany().drawnOnMap).toBe(false);
    await expect(canvas.getByRole('link', { name: 'Show on the graph' })).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Show on the map' })).toBeNull();
  },
};

/** Origin: the unit of the committed corpus that nobody located. It borrows its parent point. */
const BORROWER = 'ac1d2e3f-4051-4622-9733-b4c5d6e7f809';

const PROPOSED = 'recon_company';

// Departure: no entity of the committed corpus keeps an extracted word, so this one is given one.
const readBorrower = (): Dossier => {
  const entities = corpus.entities.map((entity) =>
    entity.id === BORROWER ? { ...entity, type: 'unknown', proposedType: PROPOSED } : entity,
  );
  const held = readDossier({ ...corpus, entities }, BORROWER, entityTypes, []);
  if (held === null) throw new Error('The committed corpus holds no 3rd Reconnaissance Company');
  return held;
};

export const TheHeaderStatesTheExtractedWordAndTheBorrowedPosition: Story = {
  args: { dossier: readBorrower() },
  play: async ({ canvas, canvasElement }) => {
    const heading = canvas.getByRole('heading', { level: 1 });
    await expect(heading).toHaveTextContent(`proposed as ${PROPOSED}`);

    // Departure: the word is a column of the promoted row, so it takes no candidate hue.
    const word = within(heading).getByText(`proposed as ${PROPOSED}`);
    await expect(word).toHaveClass('text-label');
    await expect(word).not.toHaveClass('text-candidate');

    const from = canvasElement.querySelector('[data-position-from]');
    await expect(from).toHaveTextContent('position from 92nd Coastal Battery');
  },
};

// The promotion of the entity as the history of the decisions holds it.
const readDecidedBy = (decidedAs: DecidedAct['decidedAs'], origin: string | null): Dossier => {
  const promotedFrom = corpus.entities.find((entity) => entity.id === VESSEL)?.promotedFrom;
  const proposal = corpus.proposals[0];
  if (promotedFrom === undefined || proposal === undefined)
    throw new Error('The committed corpus holds no promotion of MV Northern Ledger');
  const { op, targetKind, targetId, payload, src, names, priorValue, dissent } = proposal;
  const { authorRole, proposer, createdAt, batchId } = proposal;
  const decided: DecidedAct = {
    act: {
      id: promotedFrom,
      op,
      targetKind,
      targetId,
      payload,
      src,
      names,
      priorValue,
      dissent,
      authorRole,
      proposer,
      createdAt,
      batchId,
    },
    verdict: 'accepted',
    decidedAt: '2026-10-08T09:30:00Z',
    decidedBy: origin ?? 'operator',
    decidedAs,
    decisionOrigin: origin,
  };
  const held = readDossier(corpus, VESSEL, entityTypes, [decided]);
  if (held === null) throw new Error('The committed corpus holds no MV Northern Ledger');
  return held;
};

/** The page of an element says that a rule accepted it, and names the rule. */
export const TheElementSaysThatARuleAcceptedIt: Story = {
  args: { dossier: readDecidedBy('rule', 'rule strong_sources v1 (fact digits: 1)') },
  play: async ({ canvasElement }) => {
    const decision = canvasElement.querySelector('[data-decision]');
    await expect(decision).toHaveTextContent(
      'Accepted by the rule strong sources, version 1 on 2026-10-08',
    );
    await expect(decision).not.toHaveTextContent(/operator/u);
  },
};

/** The page of an element says that an AI reviewer accepted it, and that a human did not. */
export const TheElementSaysThatAnAIReviewerDecidedIt: Story = {
  args: { dossier: readDecidedBy('unit', 'decided by an AI reviewer') },
  play: async ({ canvasElement }) => {
    const decision = canvasElement.querySelector('[data-decision]');
    await expect(decision).toHaveTextContent(
      'Decided by an AI reviewer and not by a human on 2026-10-08',
    );
    await expect(decision).not.toHaveTextContent(/operator|validated manually/u);
  },
};

// The origin of an AI reviewer is the longest origin. On a narrow page it goes to its own line,
// and it covers no other word of the header. Departure: no story below 780 px, because the rail of
// the sources keeps 24 rem, and the record pane then has no width.
const originFitsAt = (width: number): Story => ({
  args: { dossier: readDecidedBy('unit', 'decided by an AI reviewer') },
  render: (args) => (
    <div style={{ width: `${String(width)}px`, height: '720px' }}>
      <DetailPage {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const decision = canvasElement.querySelector('[data-decision]');
    const heading = canvasElement.querySelector('h1');
    const pane = recordPaneOf(canvasElement);
    if (!(decision instanceof HTMLElement) || heading === null)
      throw new Error('the header holds no origin or no heading');
    const said = decision.getBoundingClientRect();
    const named = heading.getBoundingClientRect();
    const overlaps =
      said.left < named.right &&
      named.left < said.right &&
      said.top < named.bottom &&
      named.top < said.bottom;
    await expect(overlaps).toBe(false);
    await expect(decision.scrollWidth).toBeLessThanOrEqual(decision.clientWidth);
    await expect(said.right).toBeLessThanOrEqual(pane.getBoundingClientRect().right + 1);
    await expect(decision).toBeVisible();
  },
});

/** At 780 px, the origin of an AI reviewer covers neither the name nor the type. */
export const TheOriginOfAnAIReviewerFitsAt780Pixels: Story = originFitsAt(780);

/** The page of an element says "validated manually" when the operator decided. */
export const TheElementSaysValidatedManually: Story = {
  args: { dossier: readDecidedBy('unit', 'validated manually by the operator') },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector('[data-decision]')).toHaveTextContent(
      'Validated manually by the operator on 2026-10-08',
    );
  },
};

// Two clicks on one value are one act. A second proposal for the same value puts two entries
// that cite `manual` in the record, under the one sentence the analyst reads.
export const TwoClicksOnOneChangeWriteOneAct: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    await userEvent.type(canvas.getByLabelText('Hull note'), ' and starboard');

    const save = canvas.getByRole('button', { name: 'Save' });
    // `userEvent` refuses a control that takes no pointer event, and the button takes none once
    // it is disabled. A raw click is the second half of a double click as the browser sends it.
    await Promise.all([fireEvent.click(save), fireEvent.click(save)]);

    await expect(knock).toHaveBeenCalledTimes(1);
    await expect(knock).toHaveBeenCalledWith('/write/update-attrs', {
      targetKind: 'entity',
      targetId: VESSEL,
      attrs: { hull_note: { v: `${HULL_NOTE} and starboard` } },
    });
    await expect(save).toBeDisabled();
    await expect(saidIn(canvasElement)).toHaveTextContent('The change is going to the record.');

    door.open();
    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });
  },
};

// Departure: a value typed during the round trip reached no act, so it stands, on a key the act
// carried as on any other key.
export const ADraftTypedDuringASaveSurvives: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    const note = canvas.getByLabelText('Hull note');
    await userEvent.type(note, ' and starboard');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await userEvent.type(note, ' side');
    const flags = canvas.getByLabelText('Known flags');
    await userEvent.type(flags, ',GB');
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();

    door.open();
    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });

    await expect(note).toHaveValue(`${HULL_NOTE} and starboard side`);
    await expect(flags).toHaveValue('PA, MN,GB');
  },
};

export const ARefusalKeepsTheTypedValue: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering({ said: 'refused', refusal: BREAKS_A_SHAPE_RULE });
    const note = canvas.getByLabelText('Hull note');
    await userEvent.type(note, ' and starboard');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    door.open();

    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent('Nothing was written.');
    });
    await expect(saidIn(canvasElement)).toHaveTextContent(BREAKS_A_SHAPE_RULE);
    await expect(note).toHaveValue(`${HULL_NOTE} and starboard`);
  },
};

const mintIn = async (root: HTMLElement): Promise<void> => {
  await userEvent.type(within(root).getByLabelText('Key'), 'coal_stock_t');
  await userEvent.type(within(root).getByLabelText('Value'), '41.5');
  await userEvent.click(within(root).getByRole('button', { name: 'Add the claim' }));
};

// A new claim keeps its text until the act is signed, as a record edit does. Only the analyst
// can type it again, and the refusal sentence does not carry it.
export const ARefusedMintKeepsTheTypedText: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering({ said: 'refused', refusal: BREAKS_A_SHAPE_RULE });
    await mintIn(canvasElement);
    await expect(knock).toHaveBeenCalledWith('/write/update-attrs', {
      targetKind: 'entity',
      targetId: VESSEL,
      attrs: { coal_stock_t: { v: 41.5 } },
    });
    door.open();

    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent('Nothing was written.');
    });
    await expect(canvas.getByLabelText('Key')).toHaveValue('coal_stock_t');
    await expect(canvas.getByLabelText('Value')).toHaveValue('41.5');
  },
};

// A form that stays full after a signed mint offers the same act again.
export const ASignedMintClearsTheForm: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    await mintIn(canvasElement);
    door.open();

    await waitFor(async () => {
      await expect(canvas.getByLabelText('Key')).toHaveValue('');
    });
    await expect(canvas.getByLabelText('Value')).toHaveValue('');
    await expect(saidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    await expect(knock).toHaveBeenCalledTimes(1);
  },
};

// The writer reached the record and lost its answer. The act is one transaction, so it stands
// whole or not at all, and the page claims neither end.
export const ALostAnswerSaysTheChangeMayStand: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering({ said: 'doubt' });
    await userEvent.type(canvas.getByLabelText('Hull note'), ' and starboard');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    door.open();

    await waitFor(async () => {
      await expect(saveAlarmIn(canvasElement)).toHaveTextContent(
        'It is not known whether the change was written',
      );
    });
    await expect(saveAlarmIn(canvasElement)).not.toHaveTextContent('Nothing was written');
  },
};

// The comma between two values is the punctuation, and the space beside it is not.
export const AListTakesACommaWithNoSpace: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const flags = canvas.getByLabelText('Known flags');
    await userEvent.clear(flags);
    await userEvent.type(flags, 'GB,NO');

    await expect(canvas.queryByRole('alert')).toBeNull();
    await expect(saidIn(canvasElement)).toHaveTextContent('One value stands ready to save.');
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();

    const door = doorAnswering(SIGNED);
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    await expect(knock).toHaveBeenCalledWith('/write/update-attrs', {
      targetKind: 'entity',
      targetId: VESSEL,
      attrs: { known_flags: { v: ['GB', 'NO'] } },
    });
    door.open();
    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });
  },
};

// The record refuses the deletion of an entity that a relation stands on. It counts them and it
// names the next step, and the page shows its sentence whole.
export const ARefusedDeletionNamesTheCount: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering({
      said: 'refused',
      refusal:
        'targetId: the entity is an endpoint of 3 relations, and it is not deleted. Delete each' +
        ' of those relations first, and then delete the entity again',
    });
    await userEvent.click(canvas.getByRole('button', { name: `Delete ${DOSSIER.label}` }));
    await userEvent.click(
      canvas.getByRole('button', { name: `Confirm the deletion of ${DOSSIER.label}` }),
    );
    await expect(knock).toHaveBeenCalledWith('/write/delete-entity', { targetId: VESSEL });
    door.open();

    await waitFor(async () => {
      await expect(shapeSaidIn(canvasElement)).toHaveTextContent('an endpoint of 3 relations');
    });
    await expect(shapeSaidIn(canvasElement)).toHaveTextContent(
      'Delete each of those relations first',
    );
  },
};

// A relation the analyst makes reaches the record as one signed proposal.
export const ANewRelationNamesItsProposal: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    await userEvent.type(canvas.getByLabelText('Type'), 'berthed_at');
    await userEvent.selectOptions(canvas.getByLabelText('Other end'), COMPANY);
    await userEvent.click(canvas.getByRole('button', { name: 'Make the relation' }));

    await expect(shapeSaidIn(canvasElement)).toHaveTextContent(
      'The new relation is going to the record.',
    );
    door.open();

    await waitFor(async () => {
      await expect(shapeSaidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });
    await expect(shapeSaidIn(canvasElement)).toHaveTextContent('The relation is made');
  },
};

const RELATION_REFUSAL = 'the other end is not an entity of the record';

export const ARefusedRelationKeepsTheTypedForm: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering({ said: 'refused', refusal: RELATION_REFUSAL });
    await userEvent.type(canvas.getByLabelText('Type'), 'berthed_at');
    await userEvent.selectOptions(canvas.getByLabelText('Other end'), COMPANY);
    await userEvent.click(canvas.getByRole('button', { name: 'Make the relation' }));
    door.open();

    await waitFor(async () => {
      await expect(shapeSaidIn(canvasElement)).toHaveTextContent(RELATION_REFUSAL);
    });
    await expect(canvas.getByLabelText('Type')).toHaveValue('berthed_at');
    await expect(canvas.getByLabelText('Other end')).toHaveValue(COMPANY);
  },
};

export const ASignedRelationClearsTheForm: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    await userEvent.type(canvas.getByLabelText('Type'), 'berthed_at');
    await userEvent.selectOptions(canvas.getByLabelText('Other end'), COMPANY);
    await userEvent.click(canvas.getByRole('button', { name: 'Make the relation' }));
    door.open();

    await waitFor(async () => {
      await expect(canvas.getByLabelText('Type')).toHaveValue('');
    });
    await expect(canvas.getByLabelText('Other end')).toHaveValue('');
  },
};

// The writer lost the answer of the record. The deletion may stand, so the page claims neither
// end and it does not leave the page.
export const ALostAnswerToADeletionSaysTheRelationMayStand: Story = {
  play: async ({ canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering({ said: 'doubt' });
    await askToDelete(canvasElement, RELATION);
    await expect(knock).toHaveBeenCalledWith('/write/delete-relation', { targetId: RELATION_ID });
    door.open();

    await waitFor(async () => {
      await expect(shapeAlarmIn(canvasElement)).toHaveTextContent(
        'It is not known whether the relation was deleted',
      );
    });
    await expect(shapeAlarmIn(canvasElement)).not.toHaveTextContent('Nothing was written');
  },
};

// A connection that drops after the request bytes left carries the act with it. The writer may
// have signed and committed, so the page claims neither end.
export const ADeletionWithNoAnswerClaimsNothing: Story = {
  play: async ({ canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorGiving(NO_ANSWER);
    await askToDelete(canvasElement, DOSSIER.label);
    door.open();

    await waitFor(async () => {
      await expect(shapeAlarmIn(canvasElement)).toHaveTextContent(
        'It is not known whether the entity was deleted',
      );
    });
    const said = shapeAlarmIn(canvasElement);
    await expect(said).toHaveTextContent('Read the record again before you act.');
    await expect(said).not.toHaveTextContent('Nothing was written');
    await expect(onDeleted).not.toHaveBeenCalled();
  },
};

// A gateway answers where the writer did not, and it answers exactly where the writer most
// probably finished the act. That answer is no refusal.
export const AGatewayAnswerIsNoRefusal: Story = {
  play: async ({ canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorGiving(GATEWAY_TIMEOUT);
    await askToDelete(canvasElement, DOSSIER.label);
    door.open();

    await waitFor(async () => {
      await expect(shapeAlarmIn(canvasElement)).toHaveTextContent(
        'It is not known whether the entity was deleted',
      );
    });
    const said = shapeAlarmIn(canvasElement);
    await expect(said).toHaveTextContent('504');
    await expect(said).not.toHaveTextContent('Nothing was written');
  },
};

// One queue holds both acts. A delete that lands while a claim is in flight destroys the row
// that claim was written to, and the analyst is told nothing.
export const ASaveInFlightTakesNoDeletion: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    await userEvent.type(canvas.getByLabelText('Hull note'), ' and starboard');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await expect(canvas.getByRole('button', { name: `Delete ${DOSSIER.label}` })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: `Delete ${RELATION}` })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Make the relation' })).toBeDisabled();

    door.open();
    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });
  },
};

export const ADeletionInFlightTakesNoSave: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    await userEvent.type(canvas.getByLabelText('Hull note'), ' and starboard');
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();

    await askToDelete(canvasElement, RELATION);
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();

    door.open();
    await waitFor(async () => {
      await expect(shapeSaidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });
  },
};

// The record the page draws is the old one until the reload lands. A control left open in that
// time offers a second act on an element that is already gone.
export const ASignedDeletionHoldsTheLockUntilTheReloadLands: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const reload = reloadHeld();
    const door = doorAnswering(SIGNED);
    await askToDelete(canvasElement, RELATION);
    door.open();

    await waitFor(async () => {
      await expect(shapeSaidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });
    await waitFor(async () => {
      await expect(onSaved).toHaveBeenCalledTimes(1);
    });
    await expect(canvas.getByRole('button', { name: `Delete ${RELATION}` })).toBeDisabled();
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeDisabled();

    reload.land();
    await waitFor(async () => {
      await expect(canvas.getByRole('button', { name: `Delete ${RELATION}` })).toBeEnabled();
    });
  },
};

export const ASignedEntityDeletionLeavesThePage: Story = {
  play: async ({ canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    await askToDelete(canvasElement, DOSSIER.label);
    door.open();

    await waitFor(async () => {
      await expect(onDeleted).toHaveBeenCalledTimes(1);
    });
    await expect(onSaved).not.toHaveBeenCalled();
  },
};

// A part may hold a region of its own, and the form that makes a relation is one. The parts are
// read from the mark the band carries, and never from the role alone.
const namesOfPartsIn = (root: HTMLElement): readonly string[] =>
  Array.from(root.querySelectorAll<HTMLElement>('[data-part]')).map(
    (part) => part.getAttribute('aria-label') ?? '',
  );

export const TheFourPartsAreNamedAndSeparated: Story = {
  play: async ({ canvasElement }) => {
    const pane = recordPaneOf(canvasElement);
    await expect(namesOfPartsIn(pane)).toEqual([
      'Record',
      'Relations',
      'Pending proposals',
      'Sources of the name, the type and the map location',
    ]);
  },
};

export const EachPartStatesItsOwnCount: Story = {
  play: async ({ canvasElement }) => {
    const pane = recordPaneOf(canvasElement);
    const headingOf = (name: string): HTMLElement =>
      within(within(pane).getByRole('region', { name })).getByRole('heading', { level: 2 });

    await expect(headingOf('Record')).toHaveTextContent(String(DOSSIER.rows.length));
    await expect(headingOf('Relations')).toHaveTextContent(String(DOSSIER.relations.length));
    await expect(headingOf('Pending proposals')).toHaveTextContent(String(DOSSIER.pending.length));
    await expect(headingOf('Sources of the name, the type and the map location')).toHaveTextContent(
      String(DOSSIER.entitySources.length),
    );
  },
};

/** Departure: nothing describes a key (M11), so no name may stand between two claims of the
 * record. */
export const NoNameGroupsTwoClaimsInsideTheRecord: Story = {
  play: async ({ canvasElement }) => {
    const record = within(recordPaneOf(canvasElement)).getByRole('region', { name: 'Record' });
    const claims = record.querySelectorAll('[data-claim]');
    await expect(claims.length).toBeGreaterThan(0);
    // The band states one heading for the whole part. A second one would group the claims.
    await expect(within(record).getAllByRole('heading')).toHaveLength(1);
  },
};

// The page opens on the evidence. A control that writes stands in the writing view only.
export const ThePageOpensInTheReadingView: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await expect(canvas.getByLabelText('Hull note')).toBeDisabled();
    await expect(canvas.queryByRole('button', { name: 'Save' })).toBeNull();
    await expect(canvas.queryByRole('button', { name: `Delete ${DOSSIER.label}` })).toBeNull();
    await expect(canvas.queryByRole('button', { name: `Delete ${RELATION}` })).toBeNull();
    await expect(canvas.queryByRole('button', { name: 'Make the relation' })).toBeNull();
    await expect(canvas.queryByLabelText('Entity name')).toBeNull();
  },
};

export const TheEditSwitchOpensTheWritingView: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);

    await expect(canvas.getByRole('button', { name: 'Edit' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(canvas.getByLabelText('Hull note')).toBeEnabled();
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeVisible();
    await expect(canvas.getByRole('button', { name: `Delete ${DOSSIER.label}` })).toBeVisible();
    await expect(canvas.getByRole('button', { name: 'Make the relation' })).toBeVisible();
    await expect(canvas.getByLabelText('Entity name')).toHaveValue(DOSSIER.label);
    await expect(canvas.getByLabelText('Entity type')).toHaveValue(DOSSIER.type);
  },
};

export const ANewTypeNamesItsProposal: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    await userEvent.selectOptions(canvas.getByLabelText('Entity type'), 'company');
    await userEvent.click(canvas.getByRole('button', { name: 'Save the name and the type' }));

    await expect(shapeSaidIn(canvasElement)).toHaveTextContent(
      'The new name or type is going to the record.',
    );
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeDisabled();
    door.open();

    await waitFor(async () => {
      await expect(shapeSaidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });
    await expect(shapeSaidIn(canvasElement)).toHaveTextContent('The name and the type are saved');
    await expect(knock).toHaveBeenCalledTimes(1);
  },
};

// The reading view draws the stored record, and the typed value waits for the writing view.
export const ADraftSurvivesTheReadingView: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    await userEvent.type(canvas.getByLabelText('Hull note'), ' and starboard');

    await toggleView(canvasElement);
    await expect(canvas.getByLabelText('Hull note')).toHaveValue(HULL_NOTE);

    await toggleView(canvasElement);
    await expect(canvas.getByLabelText('Hull note')).toHaveValue(`${HULL_NOTE} and starboard`);
  },
};

// The sentence of an act in flight stands in the writing view only, so the view holds.
export const AnActInFlightHoldsTheView: Story = {
  play: async ({ canvas, canvasElement }) => {
    await toggleView(canvasElement);
    const door = doorAnswering(SIGNED);
    await userEvent.type(canvas.getByLabelText('Hull note'), ' and starboard');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeDisabled();

    door.open();
    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });
    await expect(canvas.getByRole('button', { name: 'Edit' })).toBeEnabled();
  },
};
