import { coverageOf } from '@gab/release/coverage';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { CoverageStatement } from './coverage-statement';

const coverage = coverageOf(['vessel', 'company', 'vessel', 'military_unit', 'vessel'], 2);

const meta = {
  component: CoverageStatement,
  args: { coverage, release: null },
  decorators: [
    (Story) => (
      <div className="p-4 text-body">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CoverageStatement>;

export default meta;

type Story = StoryObj<typeof meta>;

export const GivesTheCountsByTypeAndOfSources: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText(/^The record holds 5 entities and cites 2 sources\.$/u),
    ).toBeVisible();
    await expect(canvas.getByText('By type: 3 Vessel, 1 Company, 1 Military unit.')).toBeVisible();
  },
};

export const SaysThatAnAbsenceIsNotYetInTheRecord: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/not yet in the record/u)).toBeVisible();
    await expect(canvas.getByText(/does not mean "not true"/u)).toBeVisible();
  },
};

export const NamesTheVersionAndTheDayOfARelease: Story = {
  args: { release: { version: '1.0', date: '2026-11-08' } },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/^Release 1\.0 of 08\/11\/2026 holds 5 entities/u)).toBeVisible();
  },
};

export const CountsOneEntityInTheSingular: Story = {
  args: { coverage: coverageOf(['vessel'], 1) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/holds 1 entity and cites 1 source\./u)).toBeVisible();
  },
};

export const GivesNoTypeLineForAnEmptyRecord: Story = {
  args: { coverage: coverageOf([], 0) },
  play: async ({ canvas }) => {
    await expect(canvas.queryByText(/^By type/u)).toBeNull();
  },
};
