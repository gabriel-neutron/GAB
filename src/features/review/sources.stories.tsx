import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, screen, userEvent } from 'storybook/test';

import type { CitedDocument } from './queue';
import { SourceBadge } from './sources';

const RATED: CitedDocument = {
  id: 'doc_3c1104',
  title: 'Corporate registry extract — Meridian Bulk Carriers Ltd',
  href: 'https://web.archive.example.invalid/2026/registry-meridian',
  rated: true,
  score: 'A1',
  scoreOrigin: 'human',
  poor: false,
  missing: false,
  name: 'Corporate registry extract — Meridian Bulk Carriers Ltd. A1, rated by the human.',
};

const POOR: CitedDocument = {
  id: 'doc_9b0417',
  title: 'Vessel movement log, scanned',
  href: null,
  rated: true,
  score: 'D4',
  scoreOrigin: 'arbitrated',
  poor: true,
  missing: false,
  name: 'Vessel movement log, scanned. D4, rated by the arbitrated.',
};

const UNRATED: CitedDocument = {
  id: 'doc_5e7730',
  title: 'Trade press article, unverified',
  href: 'https://web.archive.example.invalid/2026/bulk-market-note',
  rated: false,
  score: 'not rated',
  scoreOrigin: '',
  poor: false,
  missing: false,
  name: 'Trade press article, unverified. not rated.',
};

const ABSENT: CitedDocument = {
  id: 'doc_0000ff',
  title: 'Cited document doc_0000ff, absent from the record',
  href: null,
  rated: false,
  score: 'not rated',
  scoreOrigin: '',
  poor: false,
  missing: true,
  name: 'Cited document doc_0000ff, absent from the record. not rated.',
};

const meta = {
  component: SourceBadge,
  args: { source: RATED },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="flex w-[560px] items-center gap-1 p-2">
      <SourceBadge {...args} />
    </div>
  ),
} satisfies Meta<typeof SourceBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The rating is the badge itself, so the glance reads it and no card prints the document. */
export const TheRatingIsTheBadge: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('A1')).toBeInTheDocument();
  },
};

/** A poor band and an absent rating are told apart: the band the badge stands for is the poor
 * one on the first, and the absence itself on the second. An absence is never a low score. */
export const APoorBandAndAnAbsentRatingAreToldApart: Story = {
  render: () => (
    <div className="flex w-[560px] items-center gap-1 p-2">
      <SourceBadge source={POOR} />
      <SourceBadge source={UNRATED} />
    </div>
  ),
  play: async ({ canvas }) => {
    const poor = canvas.getByRole('button', { name: /Vessel movement log/ });
    const absent = canvas.getByRole('button', { name: /Trade press article/ });
    await expect(poor).toHaveAttribute('data-band', 'D4');
    await expect(poor).toHaveTextContent('D4');
    await expect(poor).toHaveAccessibleName(/D4, rated by the arbitrated/);
    await expect(absent).toHaveAttribute('data-band', 'not rated');
    await expect(absent.textContent).toEqual('');
    await expect(absent).toHaveAccessibleName(/not rated/);
  },
};

/** An absence is not a low score: it draws no figure, no dash and no zero. */
export const AnUnratedDocumentDrawsNoFigure: Story = {
  args: { source: UNRATED },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText('0')).toBeNull();
    await expect(canvas.queryByText('—')).toBeNull();
    await expect(canvas.getByRole('button', { name: /not rated/ })).toBeInTheDocument();
  },
};

/** The document is one press away, and no value on the card prints it. The panel is portalled
 * to the body, so it is found on the screen and never inside the canvas. */
export const TheDocumentIsOnePressAway: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Corporate registry extract/ }));
    await expect(await screen.findByText(/Open the copy taken at ingest/)).toBeInTheDocument();
  },
};

/** A cited document with no row is drawn and never hidden: dropped evidence is worse. */
export const ACitedDocumentWithNoRowIsDrawn: Story = {
  args: { source: ABSENT },
  play: async ({ canvas }) => {
    const badge = canvas.getByRole('button', { name: /absent from the record/ });
    await expect(badge).toHaveAttribute('data-band', 'missing');
    await userEvent.click(badge);
    await expect(
      await screen.findByText('This document is cited, and the record holds no row for it.'),
    ).toBeInTheDocument();
  },
};

export const TheBadgeHoldsInTheDarkTheme: Story = {
  render: (args) => (
    <div className="dark flex w-[560px] items-center gap-1 bg-background p-2 text-foreground">
      <SourceBadge {...args} />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(canvas.getByText('A1')).toBeInTheDocument();
  },
};
