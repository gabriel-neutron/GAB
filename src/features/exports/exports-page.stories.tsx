import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import type { ExportsText } from './exports-text';
import { ExportsPage } from './exports-page';
import { EXPORTS_FIGURES } from './fixture-figures';
import { EXPORTS_RELEASE } from './fixture-release';

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const CLAIM = '0a1f0000-0000-4000-8000-000000000012';

// The text of the stories is made for the test.
const TEXT: ExportsText = {
  title: 'Russian exports',
  blocks: [
    {
      id: 'recettes',
      kind: 'section',
      title: 'What the exports pay',
      paragraphs: [['A test paragraph.']],
      attach: 'budget',
    },
    {
      id: 'registre',
      kind: 'section',
      title: 'The revenue ledger',
      paragraphs: [
        [
          'The vessel ',
          { entity: VESSEL, label: 'Severnaya Volna' },
          ' is on the list: ',
          { claim: CLAIM, text: 'the designation' },
          '. The company ',
          { entity: 'absent-entity', label: 'Company outside the release' },
          ' has no page.',
        ],
      ],
      attach: 'ledger',
    },
    {
      id: 'ecart-de-prix',
      kind: 'box',
      title: 'The price gap test',
      paragraphs: [['A test box.']],
    },
    {
      id: 'vendeurs',
      kind: 'section',
      title: 'The first-sale sellers',
      paragraphs: [['A test paragraph.']],
      attach: 'sellers',
    },
    {
      id: 'matrice',
      kind: 'section',
      title: 'The criticality matrix',
      paragraphs: [['A test paragraph.']],
      attach: 'matrix',
    },
  ],
  limits: { title: 'Limits', paragraph: ['A limits paragraph.'] },
  captions: {
    budget: 'Budget share',
    ledger: 'Revenue ledger',
    sellers: 'Sellers',
    matrix: 'Designated vessels',
  },
};

const meta = {
  component: ExportsPage,
  args: {
    text: TEXT,
    release: EXPORTS_RELEASE,
    figures: EXPORTS_FIGURES,
    links: {
      entity: (id: string) => `/entity/${id}`,
      vessel: (imo: string) => `/vessel/${imo}`,
      claim: (id: string) => `/claim/${id}`,
    },
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-svh">
      <ExportsPage {...args} />
    </div>
  ),
} satisfies Meta<typeof ExportsPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GivesEachKeptSectionTheBoxAndTheLimits: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    for (const title of [
      'What the exports pay',
      'The revenue ledger',
      'The price gap test',
      'The first-sale sellers',
      'The criticality matrix',
      'Limits',
    ])
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible();
  },
};

export const LinksACitedVesselAndClaimToTheirPages: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    const [vessel] = canvas.getAllByRole('link', { name: 'Severnaya Volna' });
    await expect(vessel).toHaveAttribute('href', `/entity/${VESSEL}`);
    await expect(canvas.getByRole('link', { name: 'the designation' })).toHaveAttribute(
      'href',
      `/claim/${CLAIM}`,
    );
  },
};

export const GivesTheAdmiraltyPairOfAClaimWhenTheReleaseHasIt: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    await expect(canvas.getAllByRole('img', { name: /^Admiralty A1/u }).length).toBeGreaterThan(0);
  },
};

export const LeavesAMentionThatTheReleaseDoesNotHoldAsText: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    await expect(canvas.getByText(/Company outside the release/u)).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Company outside the release' })).toBeNull();
  },
};

export const DrawsTheLedgerByClassAndLinksEachValueToItsDocument: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    await expect(canvas.getByRole('heading', { name: '2025' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: '2026-S1' })).toBeVisible();
    await expect(canvas.getAllByText('Class A')).toHaveLength(2);
    await expect(
      canvas.getAllByRole('link', {
        name: /^Council Implementing Regulation \(EU\) 2025\/0000, p\. 4, Cell B5$/u,
      }),
    ).toHaveLength(2);
    await expect(canvas.getByText(/^Figure 2\. Revenue ledger \(%\)\.$/u)).toBeVisible();
  },
};

export const LeavesAnAbsentSellerValueBlankAndLinksTheOthers: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    const table = canvas.getByRole('table', { name: 'Sellers' });
    const lines = table.querySelectorAll('tbody tr');
    await expect(lines).toHaveLength(3);
    // Seller Three has no value in 2023: the cell is blank and not a zero or a dash.
    const first = lines[2]?.querySelectorAll('td')[0];
    await expect(first?.textContent).toBe('');
    await expect(canvas.getAllByRole('link', { name: /^10 kt\. /u }).length).toBeGreaterThan(0);
  },
};

export const DrawsTheBudgetShareAndListsItsValuesWithTheirDocuments: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    await expect(canvas.getByRole('img', { name: /^Budget share/u })).toBeVisible();
    await userEvent.click(canvas.getByText('Values and documents'));
    const table = canvas.getByRole('table', { name: 'Budget share, values' });
    await expect(table.querySelectorAll('tbody tr')).toHaveLength(12);
  },
};

export const GivesTheMatrixWithMarksDatesAndTheActLink: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    const table = canvas.getByRole('table', { name: 'Designated vessels' });
    await expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    await expect(canvas.getByRole('link', { name: 'IMO 9000001' })).toHaveAttribute(
      'href',
      '/vessel/9000001',
    );
    await expect(canvas.getByText('2025-03-14')).toBeVisible();
    await expect(canvas.getAllByText('not listed').length).toBeGreaterThan(0);
    await expect(canvas.getByText('ended 2024-04-26')).toBeVisible();
    await expect(
      canvas.getAllByRole('link', { name: 'Council of the European Union' })[0],
    ).toHaveAttribute('href', '/entity/0a1f0000-0000-4000-8000-000000000003');
    await expect(canvas.getByText('EU, not OFAC')).toBeVisible();
  },
};

export const CountsTheMarksOfTheMatrixInItsLegend: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    await expect(
      canvas.getByText(
        '2 vessel numbers. Listed by OFAC or the UK and not by the EU: 1. Listed by the EU and not by OFAC: 1.',
      ),
    ).toBeVisible();
    await expect(
      canvas.getByText('1 vessel numbers have a listing with an end date.'),
    ).toBeVisible();
  },
};

export const SaysSoWhenAFigureFileIsNotOnTheSite: Story = {
  args: { figures: { budget: null, ledger: null, sellers: null } },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    for (const number of ['1', '2', '3'])
      await expect(
        canvas.getByText(`The data file of figure ${number} is not on this site.`),
      ).toBeVisible();
  },
};

export const SaysSoWhenTheSiteHoldsNoRelease: Story = {
  args: { release: null },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    await expect(
      canvas.getByText('This site holds no release, and the matrix comes from a release.'),
    ).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Severnaya Volna' })).toBeNull();
  },
};

export const GivesNoLegendWhenTheReleaseHoldsNoMatrixRow: Story = {
  args: { release: { ...EXPORTS_RELEASE, alignment: [] } },
  play: async ({ canvas, canvasElement }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    await expect(canvas.getByText('This release holds no alignment matrix.')).toBeVisible();
    await expect(canvasElement.querySelector('[data-matrix-legend]')).toBeNull();
  },
};

export const SaysWhenAListingClaimIsNotInTheRelease: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Russian exports' });
    await expect(canvas.getByText('2024-01-10 (no claim page)')).toBeVisible();
  },
};
