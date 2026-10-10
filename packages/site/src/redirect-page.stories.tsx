import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { FIXTURE_RELEASE } from './fixture-release.ts';
import { RedirectPage } from './redirect-page.tsx';

const VESSEL = '0a1f0000-0000-4000-8000-000000000001';

const meta = {
  component: RedirectPage,
  args: {
    release: FIXTURE_RELEASE.off,
    page: {
      path: 'entity/0a1f0000-0000-4000-8000-000000000005/index.html',
      title: 'Merged entity',
    },
    target: { path: `entity/${VESSEL}/index.html`, words: 'Severnaya Volna' },
    reason: 'A merge joined this entity to another entity, which now holds its claims:',
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof RedirectPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const AMergedEntityLinksItsSurvivor: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/A merge joined this entity/u)).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Severnaya Volna' })).toHaveAttribute(
      'href',
      `../../entity/${VESSEL}/index.html`,
    );
  },
};

export const TheVersion1PageSaysThatThisCopyHoldsNone: Story = {
  args: {
    page: { path: 'v1/index.html', title: 'Version 1' },
    target: { path: 'index.html', words: 'Open the critical nodes.' },
    reason: 'This copy of the site holds no build of the version 1 map.',
  },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText(/This copy of the site holds no build of the version 1 map\./u),
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open the critical nodes.' })).toHaveAttribute(
      'href',
      '../index.html',
    );
  },
};
