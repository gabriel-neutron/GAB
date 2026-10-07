import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, restoreAllMocks, spyOn, waitFor, within } from 'storybook/test';

import { ChangeCard } from './change-card';
import { focusOf } from './queue';
import { SAMPLE, sampleChange, sampleSubject } from './sample';

const CONTESTED = sampleSubject(SAMPLE.contestedRow);

const CHANGE = sampleChange(SAMPLE.contestedRow);

const REMOVAL = sampleChange(SAMPLE.destroyedRow);

const BESIDE = focusOf(CONTESTED, null).beside[0] ?? CHANGE;

/** The record does not hold `berth_length_m`, so this act adds it, whatever its operation
 * is called. */
const ADDITION = CONTESTED.changes.find((change) => change.kind === 'add') ?? CHANGE;

const meta = {
  component: ChangeCard,
  args: { change: CHANGE, current: true, passages: { state: 'held', passages: [], dispute: null } },
  parameters: { layout: 'fullscreen' },
  beforeEach: () => () => {
    restoreAllMocks();
  },
  // The width of one card when two stand side by side. Every mark must survive it.
  render: (args) => (
    <div className="flex h-[420px] w-[360px] p-2">
      <ChangeCard {...args} />
    </div>
  ),
} satisfies Meta<typeof ChangeCard>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The card draws no confidence, no rating and no badge of the author: the product removed
 * them, and a mark with no meaning misleads the reader. */
export const TheCardDrawsNoConfidenceNoRatingAndNoAuthorBadge: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-confidence]')).toBeNull();
    await expect(canvasElement.querySelector('[data-origin]')).toBeNull();
    await expect(canvasElement.querySelector('[data-band]')).toBeNull();
    await expect(canvasElement.querySelector('[data-hole]')).toBeNull();
    await expect(canvas.queryByText(/^machine$/)).toBeNull();
    await expect(canvas.queryByText(/not rated|threshold/)).toBeNull();
  },
};

/** An act that only names keys the record does not hold is an addition. The name of the
 * operation says `update`, and what the act does is what the card draws. */
export const AnActThatOnlyAddsKeysReadsAsAnAddition: Story = {
  args: {
    change: ADDITION,
    current: true,
    passages: { state: 'held', passages: [], dispute: null },
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Addition')).toBeInTheDocument();
    await expect(canvas.queryByText('Modification')).toBeNull();
    await expect(canvasElement.querySelector('[data-kind="add"]')).not.toBeNull();
    await expect(canvasElement.querySelectorAll('[data-op="edit"]')).toHaveLength(0);
  },
};

/** A disputed act says so on its card, in one word beside the mark. */
export const ADisputedActSaysDisputed: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-disputed]')).not.toBeNull();
    await expect(canvas.getByText('disputed')).toBeInTheDocument();
    await expect(canvas.getByText('A check disputes this act.')).toBeInTheDocument();
  },
};

/** A disputed act says why, in the words that the check recorded: the value that its passage does
 * not state, or the verdict of the checker and its reason. */
export const ADisputedActSaysWhy: Story = {
  args: {
    passages: {
      state: 'held',
      passages: [],
      dispute: 'no cited passage states attrs.flag "Panama"; the checker did not answer',
    },
  },
  play: async ({ canvas, canvasElement }) => {
    const why = canvasElement.querySelector('[data-dispute]');
    await expect(why).not.toBeNull();
    await expect(
      canvas.getByText('no cited passage states attrs.flag "Panama"; the checker did not answer'),
    ).toBeInTheDocument();
  },
};

/** With no recorded reason, the card states no reason, and still says that the act is disputed. */
export const ADisputeWithNoRecordedReasonStatesNone: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-dispute]')).toBeNull();
    await expect(canvas.getByText('disputed')).toBeInTheDocument();
  },
};

/** An act that no check disputes draws no mark of a dispute. */
export const AnUndisputedActDrawsNoDisputeMark: Story = {
  args: { change: ADDITION },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-disputed]')).toBeNull();
    await expect(canvas.queryByText('disputed')).toBeNull();
  },
};

/** The card the controls act on says so in its state, and never in a printed word: at the width
 * of two cards a word is clipped. The sentence stays for a reader who cannot see the mark. */
export const TheCurrentCardIsMarkedByItsStateAndNotByAPrintedWord: Story = {
  play: async ({ canvas, canvasElement }) => {
    const card = canvasElement.querySelector('[data-change]');
    await expect(card).toHaveAttribute('aria-current', 'true');
    await expect(canvas.queryByText(/^(Current|Selected|Open)$/)).toBeNull();
    await expect(canvas.getByText('The controls act on this one')).toBeInTheDocument();
  },
};

/** An update carries its documents on its own rows, so the card shows them once and not twice. */
export const AnUpdateShowsItsDocumentsOnItsRowsOnly: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('The documents this act stands on')).toBeNull();
  },
};

export const ACardReadBesideAnotherCarriesNoRule: Story = {
  args: { change: BESIDE, current: false },
  play: async ({ canvas, canvasElement }) => {
    const card = canvasElement.querySelector('[data-change]');
    await expect(card).not.toHaveAttribute('aria-current');
    await expect(canvas.getByText('Read beside the act under the controls')).toBeInTheDocument();
  },
};

export const ADeletionNamesTheRowItDestroys: Story = {
  args: { change: REMOVAL, current: true },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.getByText('Deletion')).toBeInTheDocument();
    const taken = canvasElement.querySelectorAll('[data-op="remove"]');
    await expect(taken.length).toBeGreaterThan(0);
    await expect(canvasElement.querySelectorAll('[data-op="edit"]')).toHaveLength(0);
    const cited = canvas.getByText('The documents this act stands on').parentElement;
    await expect(cited).not.toBeNull();
    await expect(
      within(cited ?? canvasElement).getByRole('button', { name: 'Vessel movement log, scanned' }),
    ).toBeInTheDocument();
  },
};

// Origin of a number: the `--dissent` token of the dark theme.
const DARK_DISSENT = 'oklch(0.7 0.17 28)';

export const TheCardHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark flex h-[420px] w-[360px] bg-background p-2 text-foreground">
      <ChangeCard {...args} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const disputed = canvasElement.querySelector<HTMLElement>('[data-disputed]');
    if (disputed === null) throw new Error('the card draws no mark of a dispute');
    await expect(getComputedStyle(disputed).color).toBe(DARK_DISSENT);
  },
};

const IMAGE_PASSAGE = {
  document: 'doc_3c9e5a17b2d4',
  title: 'A unit tree of the 47th brigade',
  mime: 'image/png',
  page: 1,
  text: '47-ма окрема механізована бригада',
};

// Origin: a PNG of one pixel. The card draws the bytes the writer gives, whatever they show.
const ONE_PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const asked: unknown[] = [];

// The story has no writer: the door of the image answers from here, before the card mounts.
const imageAnswers = (answer: () => Response): void => {
  asked.length = 0;
  spyOn(globalThis, 'fetch').mockImplementation((address, init) => {
    asked.push([address, init?.body]);
    return Promise.resolve(answer());
  });
};

const pngAnswer = (): Response =>
  new Response(
    Uint8Array.from(atob(ONE_PIXEL), (letter) => letter.charCodeAt(0)),
    {
      headers: { 'Content-Type': 'image/png' },
    },
  );

/** The operator compares the words that OCR read with the stored image, so the card shows the
 * image beside the excerpt, and a link opens it at full size. */
export const AnImagePassageShowsTheStoredImageBesideItsExcerpt: Story = {
  args: { passages: { state: 'held', passages: [IMAGE_PASSAGE], dispute: null } },
  beforeEach: () => {
    imageAnswers(pngAnswer);
  },
  play: async ({ canvas }) => {
    const image = await canvas.findByRole('img', {
      name: 'The stored image of A unit tree of the 47th brigade',
    });
    await expect(image.getAttribute('src')).toMatch(/^blob:/u);
    const open = canvas.getByRole('link', {
      name: 'Open the full image of A unit tree of the 47th brigade',
    });
    await expect(open.getAttribute('href')).toBe(image.getAttribute('src'));
    await expect(canvas.getByText(IMAGE_PASSAGE.text)).toBeInTheDocument();
    await expect(asked).toStrictEqual([
      ['/private/document-image', JSON.stringify({ document: IMAGE_PASSAGE.document })],
    ]);
  },
};

/** A fault of the writer or of the store says so in one sentence, and the excerpt and the rest
 * of the card stay, so the operator can still decide. */
export const AnImageThatDoesNotLoadSaysSoAndTheCardStays: Story = {
  args: { passages: { state: 'held', passages: [IMAGE_PASSAGE], dispute: null } },
  beforeEach: () => {
    imageAnswers(() =>
      Response.json({ refusal: 'the raw store did not give the image' }, { status: 503 }),
    );
  },
  play: async ({ canvas }) => {
    await waitFor(async () => {
      await expect(canvas.getByText('The stored image did not load.')).toBeInTheDocument();
    });
    await expect(canvas.queryByRole('img')).toBeNull();
    await expect(canvas.getByText(IMAGE_PASSAGE.text)).toBeInTheDocument();
    await expect(canvas.getByText('A check disputes this act.')).toBeInTheDocument();
  },
};

/** The excerpt of a text document draws as before: no image, and no request for one. */
export const ATextPassageDrawsNoImage: Story = {
  args: {
    passages: {
      state: 'held',
      passages: [{ ...IMAGE_PASSAGE, mime: 'text/html', text: 'The 47th brigade holds the line.' }],
      dispute: null,
    },
  },
  beforeEach: () => {
    imageAnswers(pngAnswer);
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('The 47th brigade holds the line.')).toBeInTheDocument();
    await expect(canvas.queryByRole('img')).toBeNull();
    await expect(asked).toStrictEqual([]);
  },
};
