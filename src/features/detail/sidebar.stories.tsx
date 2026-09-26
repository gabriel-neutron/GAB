import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { expect, screen, userEvent, within } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';

import { readDossier, type Dossier, type SourceCardModel } from './dossier';
import { Sidebar } from './sidebar';
import { entityTypes } from '@/shared/committed-fixture/entity-types';

/** MV Northern Ledger. Three claims, and its documents are `doc_9b0417`, `manual` and one more. */
const VESSEL = '7c2d9a41-5e18-4f60-a3b2-6d4e8f10c9a7';

const read = (): Dossier => {
  const held = readDossier(corpus, VESSEL, entityTypes);
  if (held === null) throw new Error('The committed corpus holds no MV Northern Ledger');
  return held;
};

const DOSSIER = read();

/** MV Kestrel Arrow. A second vessel, and its `imo` claim has the same key and another value. */
const NEXT_VESSEL = 'd4e15ccd-d7e8-4411-b5b2-a2b3c4d5e6f7';

const readNext = (): Dossier => {
  const held = readDossier(corpus, NEXT_VESSEL, entityTypes);
  if (held === null) throw new Error('The committed corpus holds no MV Kestrel Arrow');
  return held;
};

const NEXT_DOSSIER = readNext();

const SWAP = 'Select the next vessel';

/** One mounted sidebar that gets a new dossier, as a new selection on a canvas gives it. */
function SwappedSidebar() {
  const [dossier, setDossier] = useState<Dossier>(DOSSIER);

  return (
    <div className="flex h-[600px]">
      <button
        type="button"
        onClick={() => {
          setDossier(NEXT_DOSSIER);
        }}
      >
        {SWAP}
      </button>
      <Sidebar dossier={dossier} />
    </div>
  );
}

// The rows read in the alphabet of the claim key, and `aMark` below takes the first control that
// states one source. So this reads the same row, and never `DOSSIER.sources[0]`, which is the
// order the documents were first met and not the order the rows draw.
const firstCard = (): SourceCardModel => {
  const oneSource = DOSSIER.rows.find((row) => row.sources.length === 1);
  if (oneSource === undefined) throw new Error('The committed corpus holds no claim of one source');
  const ref = oneSource.sources[0];
  const held = ref === undefined ? undefined : DOSSIER.sources.find((card) => card.id === ref.id);
  if (held === undefined) throw new Error('The committed corpus cites no document on this entity');
  return held;
};

const CARD = firstCard();

/** A count, and never a number. A number points at a rail, and this surface has no rail. */
const ONE_SOURCE = '1 source document. Open it.';

const WAY_OUT = 'Open the full page at this source, in a new tab';

const aMark = (root: HTMLElement): HTMLElement => {
  const found = within(root).getAllByRole('button', { name: ONE_SOURCE })[0];
  if (found === undefined) throw new Error('No line of the sidebar states a count of one source');
  return found;
};

/**
 * The popover is portalled to the body, so it is outside `canvasElement`. `screen` reaches it.
 */
const openPopover = async (root: HTMLElement): Promise<HTMLElement> => {
  await userEvent.click(aMark(root));
  return screen.findByRole('dialog');
};

const meta = {
  component: Sidebar,
  args: { dossier: DOSSIER },
  parameters: { layout: 'fullscreen' },
  // The row states a height, exactly as the route does. Without a stated height on the row,
  // `overflow-y-auto` is not a scroll at all.
  render: (args) => (
    <div className="flex h-[600px]">
      <Sidebar {...args} />
    </div>
  ),
} satisfies Meta<typeof Sidebar>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheTopShowsTheNameAndTheTypeOnly: Story = {
  play: async ({ canvas }) => {
    const heading = canvas.getByRole('heading', { level: 1 });
    await expect(heading).toHaveTextContent(DOSSIER.label);
    await expect(heading).toHaveTextContent(DOSSIER.type);

    await expect(canvas.queryByText(DOSSIER.entityId)).toBeNull();
    // The coordinate of this entity in the committed corpus.
    await expect(canvas.queryByText(/4\.4777|51\.9244/)).toBeNull();
  },
};

export const TheSidebarCarriesNoRail: Story = {
  play: async ({ canvas }) => {
    const sidebar = canvas.getByRole('complementary', { name: DOSSIER.label });
    await expect(within(sidebar).queryByRole('complementary', { name: 'Sources' })).toBeNull();
  },
};

export const TheCountOpensEverySourceInAPopover: Story = {
  play: async ({ canvasElement }) => {
    const popover = await openPopover(canvasElement);
    await expect(popover).toHaveTextContent(CARD.title);
  },
};

export const EachLineShowsOneControlThatCountsItsSources: Story = {
  play: async ({ canvasElement }) => {
    const marks = within(canvasElement).getAllByRole('button', { name: ONE_SOURCE });
    await expect(marks.length).toBeGreaterThan(0);
    for (const mark of marks) {
      await expect(mark).toHaveTextContent('1');
    }
  },
};

/** `?src=` is kept. `?surface=` is scaffolding, and no way out must carry it. */
export const ThePopoverCarriesOneWayOut: Story = {
  play: async ({ canvasElement }) => {
    const popover = await openPopover(canvasElement);
    const link = within(popover).getByRole('link', { name: WAY_OUT });

    await expect(link).toHaveAttribute('href', `/entity/${DOSSIER.entityId}?src=${CARD.id}`);
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link.getAttribute('href') ?? '').not.toContain('surface=');
  },
};

/** `document.fonts.ready` is awaited first. The theme declares `Roboto Condensed` and
 * `JetBrains Mono`, and an installed font reflows the text after the measurement. */
export const TheSameRecordIsDrawnOneClaimToALine: Story = {
  play: async ({ canvasElement }) => {
    await document.fonts.ready;

    const cells = Array.from(canvasElement.querySelectorAll<HTMLElement>('[data-claim]'));
    await expect(cells).toHaveLength(DOSSIER.claimCount);

    const tops = new Set<number>();
    for (const cell of cells) {
      tops.add(cell.offsetTop);
    }

    await expect(tops.size).toBe(DOSSIER.claimCount);
  },
};

/** The panel holds a record. The page holds the rail of documents that no panel of 24 rem can. */
export const ThePanelCarriesOneWayOutToThePage: Story = {
  play: async ({ canvas }) => {
    const link = canvas.getByRole('link', { name: 'Open the page' });
    await expect(link).toHaveAttribute('href', `/entity/${DOSSIER.entityId}`);
    await expect(link.getAttribute('href') ?? '').not.toContain('src=');
  },
};

export const ThePanelDrawsTheSameNamedParts: Story = {
  play: async ({ canvas }) => {
    const panel = canvas.getByRole('complementary', { name: DOSSIER.label });
    const names = Array.from(panel.querySelectorAll<HTMLElement>('[data-part]')).map(
      (part) => part.getAttribute('aria-label') ?? '',
    );

    // The panel holds no rail and no line of the sources of the entity, so it names three parts
    // and never a fourth with nothing under it.
    await expect(names).toEqual(['Record', 'Relations', 'Pending proposals']);
  },
};

export const ANewSelectionDrawsTheValuesOfTheNewEntity: Story = {
  render: () => <SwappedSidebar />,
  play: async ({ canvas }) => {
    await expect(canvas.getByDisplayValue('9482137')).toBeInTheDocument();

    await userEvent.click(canvas.getByRole('button', { name: SWAP }));

    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(NEXT_DOSSIER.label);
    await expect(canvas.getByDisplayValue('9613428')).toBeInTheDocument();
    await expect(canvas.queryByDisplayValue('9482137')).toBeNull();
  },
};
