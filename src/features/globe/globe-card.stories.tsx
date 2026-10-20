import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { CHAIN, FIXTURE_RELEASE } from './fixture-release';
import { GlobeCard } from './globe-card';
import { globeData } from './globe-data';
import { createGlobeStore, type GlobeStore, type Target } from './globe-store';

const data = globeData(FIXTURE_RELEASE.chain);

// The ports of the fixed release: one is a proposal, and it has sanctions.
const PRIMORSK = '0a1f0000-0000-4000-8000-000000000004';
const IN_REVIEW_ARC = '0a1f0000-0000-4000-8000-000000000032';

const storeOn = (target: Target | null): GlobeStore => {
  const store = createGlobeStore({ steps: ['extraction'], still: false, entity: null });
  store.select(target);
  return store;
};

const meta = {
  component: GlobeCard,
  args: { data, store: storeOn(null), entityHref: (id: string) => `/entity/${id}` },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="dark w-80 border border-border bg-background text-foreground">
      <GlobeCard {...args} />
    </div>
  ),
} satisfies Meta<typeof GlobeCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SaysToSelectAPointWhenNothingIsSelected: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Select a point on the map.')).toBeVisible();
  },
};

export const TheCardOfAnEntityLinksToItsPageAndNamesItsStage: Story = {
  args: { store: storeOn({ kind: 'entity', id: CHAIN.FIELD }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'Test field' })).toHaveAttribute(
      'href',
      `/entity/${CHAIN.FIELD}`,
    );
    await expect(canvas.getByText('Facility, Fields')).toBeVisible();
  },
};

export const AnEntityInReviewSaysSoInWordsAndShowsItsSanctions: Story = {
  args: { store: storeOn({ kind: 'entity', id: PRIMORSK }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/no rule and no person checked this entity/u)).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Sanctions' })).toBeVisible();
    await expect(canvas.getByText('EU')).toBeVisible();
  },
};

export const TheCardOfALinkGivesEachVolumeWithItsSource: Story = {
  args: { store: storeOn({ kind: 'arc', id: CHAIN.FIELD_TO_PIPELINE }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Physical link, crude oil.')).toBeVisible();
    await expect(canvas.getByText(/Observed: 400 kb\/d/u)).toBeVisible();
    await expect(
      canvas.getAllByRole('link', { name: /Source: A test document/u })[0],
    ).toHaveAttribute('href', 'https://chain.example.org/page');
  },
};

export const ALinkInReviewIsNeverGivenAsAFact: Story = {
  args: { store: storeOn({ kind: 'arc', id: IN_REVIEW_ARC }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText(/In review: the link is a proposal, not a fact/u)).toBeVisible();
  },
};

export const TheCardOfAnExitPointSaysItIsNotAnEntityOfTheRecord: Story = {
  args: {
    store: storeOn({
      kind: 'exit',
      id: 'exit-sts-0a1f0000-0000-4000-8000-000000000119',
    }),
  },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Ship-to-ship transfer' })).toBeVisible();
    await expect(canvas.getByText(/not an entity of the record/u)).toBeVisible();
  },
};

export const SeveralPointsUnderOneClickGiveAChoice: Story = {
  args: {
    store: (() => {
      const store = storeOn(null);
      store.choose([
        { target: { kind: 'entity', id: CHAIN.FIELD }, label: 'Test field' },
        {
          target: { kind: 'exit', id: 'exit-sts-0a1f0000-0000-4000-8000-000000000119' },
          label: 'Ship-to-ship transfer',
        },
      ]);
      return store;
    })(),
  },
  play: async ({ args, canvas }) => {
    await expect(canvas.getByText('2 points under the click')).toBeVisible();
    await expect(
      canvas.getByRole('button', { name: 'Ship-to-ship transfer (exit point)' }),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Test field' }));
    await expect(args.store.get().panel).toStrictEqual({
      kind: 'target',
      target: { kind: 'entity', id: CHAIN.FIELD },
    });
  },
};

// The control shows on a phone only (`md:hidden`), and a story runs at one width, so it asserts
// that the control is in the card and not that it shows.
export const TheCardCarriesAControlThatClosesItOnAPhone: Story = {
  args: { store: storeOn({ kind: 'entity', id: CHAIN.FIELD }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByText('Close the card')).toBeInTheDocument();
  },
};

export const DrawsNothingWhenTheBrowserCannotDrawTheGlobe: Story = {
  args: {
    store: (() => {
      const store = storeOn(null);
      store.setUnavailable();
      return store;
    })(),
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region')).toBeNull();
  },
};
