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

import { corpus } from '@/shared/fixtures/corpus';
import { vocabulary } from '@/shared/fixtures/vocabulary';

import { DetailPage } from './detail-page';
import { readDossier, type Dossier, type SourceCardModel } from './dossier';

// A lint gate refuses a page story that mounts a live canvas. This page mounts none.
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const read = (): Dossier => {
  const held = readDossier(corpus, VESSEL, vocabulary);
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

const knock = fn();

/** The write door of the browser, answered by the story. The answer is held until `open` runs,
 * so the analyst can act while one act is in flight. */
const doorGiving = (reply: () => Response): { readonly open: () => void } => {
  let open = (): void => undefined;
  const answered = new Promise<void>((settle) => {
    open = () => {
      settle();
    };
  });
  spyOn(globalThis, 'fetch').mockImplementation(async () => {
    knock();
    await answered;
    return reply();
  });
  return { open };
};

const doorAnswering = (body: unknown): { readonly open: () => void } =>
  doorGiving(
    () => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } }),
  );

// The shape a dropped connection takes in the browser: the request left, and no answer came.
const NO_ANSWER = (): Response => {
  throw new TypeError('Failed to fetch');
};

const GATEWAY_TIMEOUT = (): Response => new Response('<html>504</html>', { status: 504 });

const PROPOSAL = 'a3f1c8de-5b20-4a71-9c34-7e0d81f65b12';

const SIGNED = { state: 'signed', proposalId: PROPOSAL, targetId: VESSEL };

const NOT_AN_IDENTIFIER = 'the value of imo is not identifier, which the key declares';

const HULL_NOTE = 'Repainted funnel, photographed 2026-05';

const saidIn = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('status', { name: 'The saving of the claims' });

const shapeSaidIn = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('status', { name: 'The shape of the record' });

const shapeAlarmIn = (root: HTMLElement): HTMLElement =>
  within(root).getByRole('alert', { name: 'The shape of the record' });

const onDeleted = fn(() => Promise.resolve());

const firstRelation = (): string => {
  const held = DOSSIER.relations[0];
  if (held === undefined) throw new Error('The vessel carries no relation');
  return held.sentence;
};

const RELATION = firstRelation();

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
    onSaved: () => Promise.resolve(),
    onDeleted,
  },
  parameters: { layout: 'fullscreen' },
  // A story that takes the door gives it back, so a play that fails leaves no stub behind.
  beforeEach: () => () => {
    knock.mockClear();
    onDeleted.mockClear();
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
    const part = canvas.getByRole('region', { name: 'Sources of this entity' });

    await expect(DOSSIER.entitySources.length).toBeGreaterThan(0);
    for (const source of DOSSIER.entitySources) {
      await expect(within(part).getByRole('button', { name: source.name })).toBeVisible();
    }
  },
};

/** The company of the committed corpus. It carries no geometry, so the map draws no point. */
const COMPANY = '3f6b1e20-9a4c-4d51-8b77-1c2e5a9d0f31';

const readCompany = (): Dossier => {
  const held = readDossier(corpus, COMPANY, vocabulary);
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

// Two clicks on one value are one act. A second proposal for the same value puts two entries
// that cite `manual` in the record, under the one sentence the analyst reads.
export const TwoClicksOnOneChangeWriteOneAct: Story = {
  play: async ({ canvas, canvasElement }) => {
    const door = doorAnswering(SIGNED);
    await userEvent.type(canvas.getByLabelText('Hull note'), ' and starboard');

    const save = canvas.getByRole('button', { name: 'Save' });
    // `userEvent` refuses a control that takes no pointer event, and the button takes none once
    // it is disabled. A raw click is the second half of a double click as the browser sends it.
    await Promise.all([fireEvent.click(save), fireEvent.click(save)]);

    await expect(knock).toHaveBeenCalledTimes(1);
    await expect(save).toBeDisabled();
    await expect(saidIn(canvasElement)).toHaveTextContent('The change is going to the record.');

    door.open();
    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });
  },
};

// A value typed during the round trip reached no act, so it stands. Only a key the act carried
// goes back to the stored value.
export const ADraftTypedDuringASaveSurvives: Story = {
  play: async ({ canvas, canvasElement }) => {
    const door = doorAnswering(SIGNED);
    const note = canvas.getByLabelText('Hull note');
    await userEvent.type(note, ' and starboard');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));

    const flags = canvas.getByLabelText('Known flags');
    await userEvent.type(flags, ',GB');
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeDisabled();

    door.open();
    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent(PROPOSAL);
    });

    await expect(note).toHaveValue(HULL_NOTE);
    await expect(flags).toHaveValue('PA, MN,GB');
  },
};

export const ARefusalKeepsTheTypedValue: Story = {
  play: async ({ canvas, canvasElement }) => {
    const door = doorAnswering({ refusal: NOT_AN_IDENTIFIER });
    const note = canvas.getByLabelText('Hull note');
    await userEvent.type(note, ' and starboard');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    door.open();

    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent('Nothing was written.');
    });
    await expect(saidIn(canvasElement)).toHaveTextContent(NOT_AN_IDENTIFIER);
    await expect(note).toHaveValue(`${HULL_NOTE} and starboard`);
  },
};

// The proposal is committed and the promotion refused it. That name is the only way back to it.
export const AnUndecidedActNamesItsProposal: Story = {
  play: async ({ canvas, canvasElement }) => {
    const door = doorAnswering({ refusal: 'the target no longer exists', proposalId: PROPOSAL });
    await userEvent.type(canvas.getByLabelText('Hull note'), ' and starboard');
    await userEvent.click(canvas.getByRole('button', { name: 'Save' }));
    door.open();

    await waitFor(async () => {
      await expect(saidIn(canvasElement)).toHaveTextContent('it was not signed');
    });
    await expect(saidIn(canvasElement)).toHaveTextContent(PROPOSAL);
  },
};

// The comma between two values is the punctuation, and the space beside it is not.
export const AListTakesACommaWithNoSpace: Story = {
  play: async ({ canvas, canvasElement }) => {
    const flags = canvas.getByLabelText('Known flags');
    await userEvent.clear(flags);
    await userEvent.type(flags, 'GB,NO');

    await expect(canvas.queryByRole('alert')).toBeNull();
    await expect(saidIn(canvasElement)).toHaveTextContent('One value stands ready to save.');
    await expect(canvas.getByRole('button', { name: 'Save' })).toBeEnabled();
  },
};

// The record refuses the deletion of an entity that a relation stands on, and it counts them.
// The count and the next step of the analyst must both reach the screen.
export const ARefusedDeletionNamesTheCount: Story = {
  play: async ({ canvas, canvasElement }) => {
    const door = doorAnswering({
      refusal: 'the entity is an endpoint of 3 relations, and it is not deleted',
    });
    await userEvent.click(canvas.getByRole('button', { name: `Delete ${DOSSIER.label}` }));
    await userEvent.click(
      canvas.getByRole('button', { name: `Confirm the deletion of ${DOSSIER.label}` }),
    );
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

// The writer signs in two transactions. The proposal committed, the promotion rolled back, and
// the entity stands. A sentence that reads as "it is deleted" sends the analyst away from a row
// that is still in the record, with an unsigned proposal to destroy it beside it.
export const AnUndecidedDeletionSaysTheEntityStands: Story = {
  play: async ({ canvasElement }) => {
    const door = doorAnswering({ refusal: 'the promotion did not run', proposalId: PROPOSAL });
    await askToDelete(canvasElement, DOSSIER.label);
    door.open();

    await waitFor(async () => {
      await expect(shapeAlarmIn(canvasElement)).toHaveTextContent('The entity is not deleted');
    });
    const said = shapeAlarmIn(canvasElement);
    await expect(said).toHaveTextContent('unsigned proposal to delete it is in the record');
    await expect(said).toHaveTextContent(PROPOSAL);
    await expect(onDeleted).not.toHaveBeenCalled();
  },
};

export const AnUndecidedRelationDeletionSaysTheRelationStands: Story = {
  play: async ({ canvasElement }) => {
    const door = doorAnswering({ refusal: 'the promotion did not run', proposalId: PROPOSAL });
    await askToDelete(canvasElement, RELATION);
    door.open();

    await waitFor(async () => {
      await expect(shapeAlarmIn(canvasElement)).toHaveTextContent('The relation is not deleted');
    });
    await expect(shapeAlarmIn(canvasElement)).toHaveTextContent(PROPOSAL);
  },
};

// A connection that drops after the request bytes left carries the act with it. The writer may
// have signed and committed, so the page claims neither end.
export const ADeletionWithNoAnswerClaimsNothing: Story = {
  play: async ({ canvasElement }) => {
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
      'Sources of this entity',
    ]);
  },
};

export const EachPartStatesItsOwnCount: Story = {
  play: async ({ canvasElement }) => {
    const pane = recordPaneOf(canvasElement);
    const headingOf = (name: string): HTMLElement =>
      within(within(pane).getByRole('region', { name })).getByRole('heading', { level: 2 });

    await expect(headingOf('Record')).toHaveTextContent(String(DOSSIER.claimCount));
    await expect(headingOf('Relations')).toHaveTextContent(String(DOSSIER.relations.length));
    await expect(headingOf('Pending proposals')).toHaveTextContent(String(DOSSIER.pending.length));
    await expect(headingOf('Sources of this entity')).toHaveTextContent(
      String(DOSSIER.entitySources.length),
    );
  },
};

/** The vocabulary declares no group, so no name may stand between two claims of the record. */
export const NoNameGroupsTwoClaimsInsideTheRecord: Story = {
  play: async ({ canvasElement }) => {
    const record = within(recordPaneOf(canvasElement)).getByRole('region', { name: 'Record' });
    const claims = record.querySelectorAll('[data-claim]');
    await expect(claims.length).toBeGreaterThan(0);
    // The band states one heading for the whole part. A second one would group the claims.
    await expect(within(record).getAllByRole('heading')).toHaveLength(1);
  },
};
