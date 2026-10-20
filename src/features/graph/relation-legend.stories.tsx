import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { RelationLegend } from './relation-legend';
import { deriveLegend } from './relation-legend-rows';

const wordsOf = (key: string) => ({ label: key.replaceAll('_', ' ') });

const counts = new Map([
  ['owns', { shown: 12, total: 12 }],
  ['operates', { shown: 7, total: 9 }],
  ['designated_by', { shown: 3, total: 3 }],
  ['sts_with', { shown: 4, total: 4 }],
]);

const meta = {
  component: RelationLegend,
  decorators: [
    (Story) => (
      <div className="dark w-[56rem] bg-background text-foreground">
        <Story />
      </div>
    ),
  ],
  args: { legend: deriveLegend(counts, new Set(), wordsOf), onSwitch: fn() },
} satisfies Meta<typeof RelationLegend>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The families the record holds, and no more: an empty family has no column. */
export const NamesOneColumnForEachFamilyThatHoldsARelation: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Ownership')).toBeVisible();
    await expect(canvas.getByText('Ship-to-ship transfer')).toBeVisible();
    await expect(canvas.queryByText('Other relations')).toBeNull();
  },
};

/** Owns and sts with sit in two families, and each family has its own line in the legend. */
export const OwnsAndStsWithStandInTwoFamilies: Story = {
  play: async ({ canvasElement }) => {
    const owns = canvasElement.querySelector('[data-family="ownership"] line');
    const sts = canvasElement.querySelector('[data-family="transfer"] line');
    await expect(owns).not.toBeNull();
    await expect(sts).not.toBeNull();
    await expect(owns?.getAttribute('stroke')).not.toBe(sts?.getAttribute('stroke'));
    await expect(owns?.getAttribute('stroke-dasharray')).not.toBe(
      sts?.getAttribute('stroke-dasharray'),
    );
  },
};

/** Each row and each family say the count shown of the total. */
export const SaysTheCountShownOfTheTotal: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('button', { name: /^operates/u })).toHaveTextContent('7 of 9');
    await expect(canvas.getByText('7 of 9', { selector: 'div > span' })).toBeVisible();
  },
};

/** A switch asks the caller to hide the type. */
export const ASwitchAsksToHideTheType: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /^sts with/u }));
    await expect(args.onSwitch).toHaveBeenCalledWith('sts_with', false);
  },
};

/** A type that is off keeps its total, says the state in words, and a click brings it back. */
export const ATypeThatIsOffSaysSoInWords: Story = {
  args: { legend: deriveLegend(counts, new Set(['sts_with']), wordsOf) },
  play: async ({ canvas, args }) => {
    const button = canvas.getByRole('button', { name: /^sts with/u });
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button).toHaveTextContent('hidden');
    await userEvent.click(button);
    await expect(args.onSwitch).toHaveBeenCalledWith('sts_with', true);
  },
};
