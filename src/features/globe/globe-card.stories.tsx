import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, userEvent } from 'storybook/test';

import { CHAIN, FIXTURE_RELEASE } from './fixture-release';
import { GlobeCard } from './globe-card';
import { globeData } from './globe-data';
import { createGlobeStore, type GlobeStore, type Target } from './globe-store';
import { ArcCard, ExitCard } from './link-card';

const data = globeData(FIXTURE_RELEASE.chain);

// A link of the fixed release that is a proposal.
const IN_REVIEW_ARC = '0a1f0000-0000-4000-8000-000000000032';

// The route gives the panel of the graph for an entity. A story mounts no record, so a heading
// with the label stands in its place, and the card of a link and of an exit is the real one.
const cardOf = (target: Target) => {
  if (target.kind === 'arc') {
    const arc = data.arcInfo[target.id];
    return arc === undefined ? null : <ArcCard arc={arc} />;
  }
  if (target.kind === 'exit') {
    const exit = data.exitInfo[target.id];
    return exit === undefined ? null : <ExitCard exit={exit} />;
  }
  return <h2>{data.cards[target.id]?.label}</h2>;
};

const storeOn = (target: Target | null): GlobeStore => {
  const store = createGlobeStore({ steps: ['extraction'], still: false, entity: null });
  store.select(target);
  return store;
};

const meta = {
  component: GlobeCard,
  args: { cardOf, store: storeOn(null) },
  parameters: { layout: 'padded' },
  render: (args) => (
    <div className="dark w-80 border border-border bg-background text-foreground">
      <GlobeCard {...args} />
    </div>
  ),
} satisfies Meta<typeof GlobeCard>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DrawsNoCardWhenNothingIsSelected: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('region', { name: 'Card of the selection' })).toBeNull();
  },
};

/** The card shows what the route gives for the target. */
export const TheCardShowsWhatTheRouteGivesForTheTarget: Story = {
  args: { store: storeOn({ kind: 'entity', id: CHAIN.FIELD }) },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { name: 'Test field' })).toBeVisible();
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

/** The close control shows at every width, and it closes the card. */
export const TheCardCarriesAVisibleControlThatClosesIt: Story = {
  args: { store: storeOn({ kind: 'entity', id: CHAIN.FIELD }) },
  play: async ({ args, canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Close panel' }));
    await expect(args.store.get().panel).toStrictEqual({ kind: 'none' });
  },
};

/** A key opens a card from the choice: the focus moves to the heading, and Escape closes it. */
export const AKeyOpensTheCardWithTheFocusOnItsHeading: Story = {
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
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.keyboard('{Enter}');
    await expect(canvas.getByRole('heading', { name: 'Test field' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    await expect(args.store.get().panel).toStrictEqual({ kind: 'none' });
    await expect(canvas.queryByRole('region', { name: 'Card of the selection' })).toBeNull();
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
