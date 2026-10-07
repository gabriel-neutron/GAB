import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { Justification } from './justification';
import { unitPageOf } from './unit-page';
import { SAMPLE_UNITS, UNIT_ANSWER } from './unit-sample';

const units = unitPageOf(UNIT_ANSWER)?.units ?? [];

const unitOf = (id: string) => units.find((unit) => unit.id === id) ?? null;

const meta = {
  component: Justification,
  args: { unit: unitOf(SAMPLE_UNITS.disputed) },
  render: (args) => (
    <div className="flex h-[480px] w-[416px] flex-col border border-border">
      <Justification {...args} />
    </div>
  ),
} satisfies Meta<typeof Justification>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The proposer is named in words: the extractor, the research AI or the v1 import. */
export const TheProposerIsNamed: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('extractor')).toBeVisible();
    await expect(canvas.queryByText('machine')).toBeNull();
  },
};

/** The document is a link, and the passage has a link that opens its page. */
export const TheSourceOpensAtItsPage: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('link', { name: 'Financial sanctions and the trade of Russia' }),
    ).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open page 14' })).toHaveAttribute(
      'href',
      'https://www.newyorkfed.org/medialibrary/media/research/staff_reports/sr1047.pdf#page=14',
    );
  },
};

/** The exact words of the page stand out from the two lines before and after them. */
export const ThePassageHasTwoLinesAroundIt: Story = {
  play: async ({ canvasElement }) => {
    const exact = canvasElement.querySelector('[data-passage] mark');
    await expect(exact).toHaveTextContent('European and Asian countries');
    const quote = canvasElement.querySelector('[data-passage] blockquote');
    await expect(quote).toHaveTextContent(/The rows group the partners by region\./u);
    await expect(quote).toHaveTextContent(/The next section turns to the prices\./u);
  },
};

/** A dispute shows its reason. */
export const ADisputeShowsItsReason: Story = {
  play: async ({ canvas }) => {
    await expect(
      canvas.getByText('no cited passage states label "North American countries"'),
    ).toBeVisible();
  },
};

/** A file of the operator has no address, so it is no link, and the long addresses in its line
 * are short links. */
export const AFileWithNoAddressIsNoLink: Story = {
  args: { unit: unitOf(SAMPLE_UNITS.army) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Page 1')).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'voinskaya-chast-poisk.ru' })).toBeVisible();
    await expect(canvas.getByText('No act of this unit is disputed.')).toBeVisible();
  },
};
