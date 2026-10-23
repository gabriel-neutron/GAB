import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { DATA_RELEASE } from './fixture-release';

import { DataPage } from './data-page';

const meta = {
  component: DataPage,
  args: { release: DATA_RELEASE, fileHref: (path: string) => `/release/${path}` },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DataPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ShowsEveryRowAndTheCountBeforeAnyFilter: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/^\d+ of \d+ rows\./u)).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Download these rows/u })).toBeEnabled();
  },
};

export const ATextThatMatchesNoRowDisablesTheDownload: Story = {
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole('searchbox'), 'zzzzzz-no-such-name');
    await expect(canvas.getByText(/^0 of \d+ rows\./u)).toBeVisible();
    await expect(canvas.getByRole('button', { name: /Download these rows/u })).toBeDisabled();
  },
};

export const WithNoReleaseItSaysSo: Story = {
  args: { release: null },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/holds no release/u)).toBeVisible();
  },
};
