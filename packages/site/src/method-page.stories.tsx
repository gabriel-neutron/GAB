import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { FIXTURE_RELEASE } from './fixture-release.ts';
import { MethodPage } from './method-page.tsx';

const meta = {
  component: MethodPage,
  args: { release: FIXTURE_RELEASE.off },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof MethodPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TheDisclaimerGivesTheMeaningOfEachLabel: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Proposed — not checked:')).toBeVisible();
    await expect(canvas.getByText('Validated manually by the operator:')).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'The rating method' })).toBeVisible();
  },
};

export const WithThePairOffThePairIsNotExplained: Story = {
  play: async ({ canvas, canvasElement }) => {
    await expect(
      canvas.getByText('This release does not show the rating of a claim.'),
    ).toBeVisible();
    await expect(canvasElement.textContent).not.toMatch(/NATO|\b[A-F][1-6]\b/u);
  },
};

export const WithThePairOnThePairIsExplained: Story = {
  args: { release: FIXTURE_RELEASE.on },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/STANAG 2511/u)).toBeVisible();
  },
};

export const TheCountsOfTheCandidatesAcrossTwoScriptsShow: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'One name in two scripts' })).toBeVisible();
    await expect(
      canvas.getByText('Candidates at this release: 3 waiting, 2 confirmed, 1 refused.'),
    ).toBeVisible();
  },
};
