import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, within } from 'storybook/test';

import { FIXTURE_RELEASE } from './fixture-release.ts';
import { HomePage } from './home-page.tsx';

const meta = {
  component: HomePage,
  args: { release: FIXTURE_RELEASE.off },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof HomePage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheRetainedNodesComeFirst: Story = {
  play: async ({ canvas }) => {
    const [retained, others] = canvas.getAllByRole('table');
    await expect(retained).toHaveAccessibleName('Retained nodes');
    await expect(others).toHaveAccessibleName('Other candidate nodes');
    if (retained === undefined) return;
    await expect(within(retained).getByRole('link', { name: 'Severnaya Volna' })).toBeVisible();
    await expect(within(retained).getByText('not sourced')).toBeVisible();
  },
};

export const EachTickLinksItsClaims: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('link', {
        name: 'Severnaya Volna designated by Council of the European Union',
      }),
    ).toHaveAttribute('href', 'claim/0a1f0000-0000-4000-8000-000000000012/index.html');
  },
};

export const ThePageGivesTheVersionAndTheContacts: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/Version of 08\/11\/2026/u)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Report an error' })).toHaveAttribute(
      'href',
      'https://example.org/report-an-error',
    );
    await expect(canvas.getByRole('link', { name: 'Right of reply' })).toHaveAttribute(
      'href',
      'mailto:reply@example.org',
    );
  },
};

export const WithThePairOnEachClaimShowsItsPair: Story = {
  args: { release: FIXTURE_RELEASE.on },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('NATO A1')).toBeVisible();
  },
};
