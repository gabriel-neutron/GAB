import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect } from 'storybook/test';

import { FIXTURE_RELEASE } from './fixture-release';
import { RelationPage } from './relation-page';

const RELATION = '0a1f0000-0000-4000-8000-000000000011';

const meta = {
  component: RelationPage,
  args: {
    release: FIXTURE_RELEASE.off,
    relationId: RELATION,
    claimHref: (id: string) => `/claim/${id}`,
  },
  parameters: { layout: 'fullscreen' },
  render: (args) => (
    <div className="h-svh">
      <RelationPage {...args} />
    </div>
  ),
} satisfies Meta<typeof RelationPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const ARelationLinksItsClaim: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('link', { name: 'the claim of this relation' })).toHaveAttribute(
      'href',
      `/claim/${RELATION}`,
    );
  },
};

export const AnUnknownRelationShowsNotFound: Story = {
  args: { relationId: 'no-such-relation' },
  play: async ({ canvas }) => {
    await expect(
      canvas.getByRole('heading', { level: 1, name: 'Relation not found' }),
    ).toBeVisible();
  },
};
