import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, restoreAllMocks, spyOn, userEvent, waitFor } from 'storybook/test';

import { Justification } from './justification';
import { unitPageOf } from './unit-page';
import { SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';

const units = unitPageOf(UNIT_ANSWER, null)?.units ?? [];

const unitOf = (id: string) => units.find((unit) => unit.id === id) ?? null;

const TEXT_UNIT = unitOf(SAMPLE_UNITS.army);

const IMAGE_TITLE = 'A unit tree of the 47th brigade';

// The file of the operator is a scan here: the same words, read by OCR from a stored PNG.
const IMAGE_UNIT =
  TEXT_UNIT === null
    ? null
    : {
        ...TEXT_UNIT,
        documents: TEXT_UNIT.documents.map((document) => ({
          ...document,
          title: IMAGE_TITLE,
          mime: 'image/png',
        })),
      };

const IMAGE_DOCUMENT = IMAGE_UNIT?.documents[0]?.id ?? '';

// Origin: a PNG of one pixel. The justification draws the bytes the writer gives, whatever they
// show.
const ONE_PIXEL =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const asked: unknown[] = [];

// The story has no writer: the door of the image answers from here, before the view mounts.
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
    { headers: { 'Content-Type': 'image/png' } },
  );

const meta = {
  component: Justification,
  args: { unit: unitOf(SAMPLE_UNITS.disputed) },
  beforeEach: () => () => {
    restoreAllMocks();
  },
  render: (args) => (
    <div className="flex h-[480px] w-[416px] flex-col border border-border">
      <Justification {...args} />
    </div>
  ),
} satisfies Meta<typeof Justification>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The proposer is named in words: the extractor, the research AI or the v1 import. */
export const TheProposerIsNamed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('extractor')).toBeVisible();
    await expect(canvas.queryByText('machine')).toBeNull();
  },
};

/** The document is a link, and the passage has a link that opens its page. */
export const TheSourceOpensAtItsPage: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('link', { name: 'Financial sanctions and the trade of Russia' }),
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open page 14' })).toHaveAttribute(
      'href',
      'https://www.newyorkfed.org/medialibrary/media/research/staff_reports/sr1047.pdf#page=14',
    );
  },
};

/** The exact words of the page stand out from the two lines before and after them. */
export const ThePassageHasTwoLinesAroundIt: Story = {
  play: async ({ canvasElement }) => {
    const exact = canvasElement.querySelector('[data-passage] mark');
    await expect(exact).toHaveTextContent('European and Asian countries');
    const quote = canvasElement.querySelector('[data-passage] blockquote');
    await expect(quote).toHaveTextContent(/The rows group the partners by region\./u);
    await expect(quote).toHaveTextContent(/The next section turns to the prices\./u);
  },
};

/** A dispute shows its reason, under the faults that keep the unit out of a group action. */
export const ADisputeShowsItsReason: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('Disputed: no cited passage states label "North American countries".'),
    ).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Not clean: decide it alone' })).toBeVisible();
  },
};

/** Each kind of fault has its sentence, under the level that says what it does to the unit. */
export const EachFaultIsListedWithItsText: Story = {
  args: { unit: unitOf(SAMPLE_UNITS.blockedMix) },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelectorAll('li[data-fault]')).toHaveLength(12);
    for (const name of ['Blocks Promote', 'Not clean: decide it alone', 'Information'])
      await expect(canvas.getByRole('heading', { name })).toBeVisible();
    await expect(
      canvas.getByText('The act 68th GRAU arsenal cites no passage of a source.'),
    ).toBeVisible();
    await expect(
      canvas.getByText('Sources from the parent Southern Military District.'),
    ).toBeVisible();
    await expect(
      canvas.getByText('Rejected before on 2026-10-06: Wrong value (A ferry.).'),
    ).toBeVisible();
  },
};

/** A wait for an entity of the same group is no fault: a group action writes the unit, and only
 * the decision bar says why Promote of the unit alone is off. */
export const AWaitInTheGroupIsNoFaultOfTheUnit: Story = {
  args: { unit: unitOf(SAMPLE_UNITS.brigade) },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvas.queryByText(/in this group: promote it first/u)).toBeNull();
    await expect(canvasElement.querySelector('[data-fault="end_waits_in_group"]')).toBeNull();
    await expect(canvas.getByText('The position is approximate.')).toBeVisible();
  },
};

/** A file of the operator has no address, so it is no link, and the long addresses in its line
 * are short links. */
export const AFileWithNoAddressIsNoLink: Story = {
  args: { unit: unitOf(SAMPLE_UNITS.army) },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-passage] figcaption')).toHaveTextContent(
      'Evidence for 5th Combined Arms Army · page 1',
    );
    await expect(canvas.queryByRole('link', { name: /Open page/u })).toBeNull();
    await userEvent.click(canvas.getByText('The v1 record of this unit'));
    await expect(canvas.getByRole('link', { name: 'voinskaya-chast-poisk.ru' })).toBeVisible();
    await expect(canvas.getByText('No fault.')).toBeVisible();
    await expect(canvas.queryByText(/A group action can promote/u)).toBeNull();
  },
};

/** A line of the v1 import is folded: the record of the unit, and in it the lines of the other
 * units around it. */
export const AV1LineFoldsTheLinesOfOtherUnits: Story = {
  args: { unit: unitOf(SAMPLE_UNITS.army) },
  play: async ({ canvas, canvasElement }) => {
    const passage = canvasElement.querySelector('[data-passage]');
    await expect(passage).toHaveAttribute('data-own-line', 'true');
    const record = passage?.querySelector('details');
    if (!(record instanceof HTMLDetailsElement)) throw new Error('the record is not folded');
    await expect(record.open).toBe(false);
    await expect(canvas.getByText('The v1 record of this unit')).toBeVisible();
    await expect(canvas.getByText('The lines of other units around it')).not.toBeVisible();
    await userEvent.click(canvas.getByText('The v1 record of this unit'));
    await expect(passage?.querySelector('mark')).toHaveTextContent('5th Combined Arms Army');
    await expect(canvas.getByText('The lines of other units around it')).toBeVisible();
  },
};

/** A document whose title is its address is named by its host and its file name, as one link. */
export const AnAddressTitleIsNamedByItsHostAndFile: Story = {
  args: {
    unit: (() => {
      const disputed = unitOf(SAMPLE_UNITS.disputed);
      return disputed === null
        ? null
        : {
            ...disputed,
            documents: disputed.documents.map((document) => ({
              ...document,
              title: 'www.ebrd.com/content/dam/ebrd_dxp/working-papers-2023/WP-276.pdf',
            })),
          };
    })(),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'ebrd.com: WP-276.pdf' })).toBeVisible();
    await expect(canvas.getByText('North American countries')).toBeVisible();
  },
};

/** The operator compares the words that OCR read with the stored image, so the image stands
 * beside the passages of its document, and a link opens it at full size. The image is read once
 * for the document. */
export const AnImageDocumentShowsTheStoredImageBesideItsPassages: Story = {
  args: { unit: IMAGE_UNIT },
  beforeEach: () => {
    imageAnswers(pngAnswer);
  },
  play: async ({ canvas, canvasElement }) => {
    const image = await canvas.findByRole('img', { name: `The stored image of ${IMAGE_TITLE}` });
    await expect(image.getAttribute('src')).toMatch(/^blob:/u);
    const open = canvas.getByRole('link', { name: `Open the full image of ${IMAGE_TITLE}` });
    await expect(open.getAttribute('href')).toBe(image.getAttribute('src'));
    await expect(canvasElement.querySelector('[data-passage]')).toBeVisible();
    await expect(asked).toStrictEqual([
      ['/private/document-image', JSON.stringify({ document: IMAGE_DOCUMENT })],
    ]);
  },
};

/** A fault of the writer or of the store says so in one sentence, and the passages stay, so the
 * operator can still decide. */
export const AnImageThatDoesNotLoadSaysSoAndThePassagesStay: Story = {
  args: { unit: IMAGE_UNIT },
  beforeEach: () => {
    imageAnswers(() =>
      Response.json({ refusal: 'the raw store did not give the image' }, { status: 503 }),
    );
  },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(async () => {
      await expect(canvas.getByText('The stored image did not load.')).toBeVisible();
    });
    await expect(canvas.queryByRole('img')).toBeNull();
    await expect(canvasElement.querySelector('[data-passage]')).toBeVisible();
  },
};

/** Bytes that the writer names as a PNG image, and that no browser draws, give the same sentence
 * as a fault of the writer. */
export const AnImageThatDoesNotDrawSaysSo: Story = {
  args: { unit: IMAGE_UNIT },
  beforeEach: () => {
    imageAnswers(() => new Response('not a picture', { headers: { 'Content-Type': 'image/png' } }));
  },
  play: async ({ canvas, canvasElement }) => {
    await waitFor(async () => {
      await expect(canvas.getByText('The stored image did not load.')).toBeVisible();
    });
    await expect(canvas.queryByRole('img')).toBeNull();
    await expect(canvasElement.querySelector('[data-passage]')).toBeVisible();
  },
};

/** The passages of a text document draw as before: no image, and no request for one. */
export const ATextDocumentDrawsNoImage: Story = {
  args: { unit: TEXT_UNIT },
  beforeEach: () => {
    imageAnswers(pngAnswer);
  },
  play: async ({ canvas, canvasElement }) => {
    await expect(canvasElement.querySelector('[data-passage]')).toBeVisible();
    await expect(canvas.queryByRole('img')).toBeNull();
    await expect(asked).toStrictEqual([]);
  },
};
