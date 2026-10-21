import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import type { ExportsText } from './exports-text';
import { ExportsPage } from './exports-page';
import { EXPORTS_FIGURES } from './fixture-figures';
import { EXPORTS_RELEASE } from './fixture-release';

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';
const CLAIM = '0a1f0000-0000-4000-8000-000000000012';

// The text of the stories is made for the test. The real text comes from the writing step.
const TEXT: ExportsText = {
  title: 'Les exportations russes',
  blocks: [
    {
      id: 'recettes',
      kind: 'section',
      title: 'Ce que paient les exportations',
      paragraphs: [['Un paragraphe de test.']],
      attach: 'budget',
    },
    {
      id: 'registre',
      kind: 'section',
      title: 'Le registre des revenus',
      paragraphs: [
        [
          'Le navire ',
          { entity: VESSEL, label: 'Severnaya Volna' },
          ' figure sur la liste : ',
          { claim: CLAIM, text: 'la désignation' },
          '. La société ',
          { entity: 'absent-entity', label: 'Société hors publication' },
          ' n’a pas de page.',
        ],
      ],
      attach: 'ledger',
    },
    {
      id: 'ecart-de-prix',
      kind: 'box',
      title: 'Le test de l’écart de prix',
      paragraphs: [['Un encadré de test.']],
    },
    {
      id: 'vendeurs',
      kind: 'section',
      title: 'Les vendeurs de première vente',
      paragraphs: [['Un paragraphe de test.']],
      attach: 'sellers',
    },
    {
      id: 'matrice',
      kind: 'section',
      title: 'La matrice de criticité',
      paragraphs: [['Un paragraphe de test.']],
      attach: 'matrix',
    },
  ],
  limits: { title: 'Limites', paragraph: ['Un paragraphe de limites.'] },
  captions: {
    budget: 'Part du budget',
    ledger: 'Registre des revenus',
    sellers: 'Vendeurs',
    matrix: 'Navires désignés',
  },
};

const meta = {
  component: ExportsPage,
  args: {
    text: TEXT,
    release: EXPORTS_RELEASE,
    figures: EXPORTS_FIGURES,
    entityHref: (id: string) => `/entity/${id}`,
    vesselHref: (imo: string) => `/vessel/${imo}`,
    claimHref: (id: string) => `/claim/${id}`,
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
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    for (const title of [
      'Ce que paient les exportations',
      'Le registre des revenus',
      'Le test de l’écart de prix',
      'Les vendeurs de première vente',
      'La matrice de criticité',
      'Limites',
    ])
      await expect(canvas.getByRole('heading', { name: title })).toBeVisible();
  },
};

export const LinksACitedVesselAndClaimToTheirPages: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    const [vessel] = canvas.getAllByRole('link', { name: 'Severnaya Volna' });
    await expect(vessel).toHaveAttribute('href', `/entity/${VESSEL}`);
    await expect(canvas.getByRole('link', { name: 'la désignation' })).toHaveAttribute(
      'href',
      `/claim/${CLAIM}`,
    );
  },
};

export const GivesTheAdmiraltyPairOfAClaimWhenTheReleaseHasIt: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    await expect(canvas.getAllByRole('img', { name: /^Admiralty A1/u }).length).toBeGreaterThan(0);
  },
};

export const LeavesAMentionThatTheReleaseDoesNotHoldAsText: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    await expect(canvas.getByText(/Société hors publication/u)).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Société hors publication' })).toBeNull();
  },
};

export const DrawsTheLedgerByClassAndLinksEachValueToItsDocument: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    await expect(canvas.getByRole('heading', { name: '2025' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: '2026-S1' })).toBeVisible();
    await expect(canvas.getAllByText('Classe A')).toHaveLength(2);
    await expect(
      canvas.getAllByRole('link', {
        name: /^Council Implementing Regulation \(EU\) 2025\/0000, p\. 4, Cell B5$/u,
      }),
    ).toHaveLength(2);
    await expect(canvas.getByText(/^Figure 2\. Registre des revenus \(%\)\.$/u)).toBeVisible();
  },
};

export const LeavesAnAbsentSellerValueBlankAndLinksTheOthers: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    const table = canvas.getByRole('table', { name: 'Vendeurs' });
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
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    await expect(canvas.getByRole('img', { name: /^Part du budget/u })).toBeVisible();
    await userEvent.click(canvas.getByText('Values and documents'));
    const table = canvas.getByRole('table', { name: 'Part du budget, values' });
    await expect(table.querySelectorAll('tbody tr')).toHaveLength(12);
  },
};

export const GivesTheMatrixWithMarksDatesAndTheActLink: Story = {
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    const table = canvas.getByRole('table', { name: 'Navires désignés' });
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
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
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
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    for (const number of ['1', '2', '3'])
      await expect(
        canvas.getByText(`The data file of figure ${number} is not on this site.`),
      ).toBeVisible();
  },
};

export const SaysSoWhenTheSiteHoldsNoRelease: Story = {
  args: { release: null },
  play: async ({ canvas }) => {
    await canvas.findByRole('heading', { name: 'Les exportations russes' });
    await expect(
      canvas.getByText('This site holds no release, and the matrix comes from a release.'),
    ).toBeVisible();
    await expect(canvas.queryByRole('link', { name: 'Severnaya Volna' })).toBeNull();
  },
};
