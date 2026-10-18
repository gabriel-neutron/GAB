import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { SourceEntry } from './source-entry';

const meta = {
  component: SourceEntry,
  args: {
    source: {
      documentId: '0b7c5e1a-2f4d-4c1e-9a7b-3d2e1f0a9b8c',
      title: 'Port of Rotterdam — bulk cargo throughput, Q2 2026',
      address: 'https://example.invalid/rotterdam/q2-2026',
      readOn: '2026-07-14',
      passages: [
        {
          page: '3',
          excerpt: 'Crude oil throughput rose by four per cent against the same quarter.',
          modality: 'text',
          transcribed: false,
        },
        {
          page: '7',
          excerpt: 'The terminal received eleven tankers in June.',
          modality: 'image',
          transcribed: true,
        },
      ],
    },
  },
  parameters: { layout: 'padded' },
} satisfies Meta<typeof SourceEntry>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AWebAddressIsALink: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('link', { name: 'https://example.invalid/rotterdam/q2-2026' }),
    ).toHaveAttribute('href', 'https://example.invalid/rotterdam/q2-2026');
  },
};

export const AScriptAddressStaysText: Story = {
  args: {
    source: {
      documentId: 'd1',
      title: 'A page with a script address',
      address: 'javascript:alert(1)',
      readOn: null,
      passages: null,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('link')).toBeNull();
    await expect(canvas.getByText('javascript:alert(1)')).toBeVisible();
  },
};

export const EachPassageNamesItsPageAndAnAiReading: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Page 3, text')).toBeVisible();
    await expect(
      canvas.getByText('Page 7, image, read by an AI from an image of the page'),
    ).toBeVisible();
  },
};

export const NoPassageForTheClaimGivesOneSentence: Story = {
  args: {
    source: {
      documentId: 'd2',
      title: 'Trade press article',
      address: null,
      readOn: '2026-07-30',
      passages: [],
    },
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('The release holds no passage of this document for this claim.'),
    ).toBeVisible();
  },
};

export const ThePageOfManyClaimsShowsNoPassage: Story = {
  args: {
    source: {
      documentId: 'd3',
      title: 'Corporate registry extract',
      address: null,
      readOn: '2026-06-02',
      passages: null,
    },
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('figure')).toBeNull();
    await expect(canvas.queryByText(/passage/)).toBeNull();
  },
};
