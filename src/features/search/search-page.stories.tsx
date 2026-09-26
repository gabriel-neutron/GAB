import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';

import { searchByName } from './name-search';
import { SearchPage } from './search-page';

const onQueryChange = fn();

const hrefOf = (entityId: string): string => `/entity/${encodeURIComponent(entityId)}`;

const meta = {
  component: SearchPage,
  args: {
    query: 'northern ledger',
    answer: searchByName(corpus.entities, 'northern ledger'),
    onQueryChange,
    hrefOf,
  },
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof SearchPage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A hit is a way to the page of that entity, and it names the type beside the name. */
export const EachMatchOpensItsEntity: Story = {
  play: async ({ canvas }) => {
    const vessel = canvas.getByRole('link', { name: /^MV Northern Ledger/ });
    const company = canvas.getByRole('link', { name: /^Northern Ledger Shipping SA/ });
    await expect(company).toHaveAttribute('href', expect.stringMatching(/^\/entity\//));
    await expect(vessel).toBeVisible();
    await expect(canvas.getByRole('status')).toHaveTextContent('entity names hold');
  },
};

/** The field reports each keystroke to the caller, and it holds no query of its own. */
export const TypingIsAnnouncedToTheCaller: Story = {
  play: async ({ canvas }) => {
    onQueryChange.mockClear();
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Entity name' }), 'x');
    await expect(onQueryChange).toHaveBeenCalledWith('northern ledgerx');
  },
};

/** An empty field states what to do and how large the corpus is, and it draws no list. */
export const AnEmptyFieldAsksForAName: Story = {
  args: { query: '', answer: searchByName(corpus.entities, '') },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('Type a part of a name.');
    await expect(canvas.queryByRole('list', { name: 'Matches' })).toBeNull();
  },
};

/** A query that finds nothing says so in words, and it draws no list. */
export const NoMatchIsStated: Story = {
  args: { query: 'zzqx', answer: searchByName(corpus.entities, 'zzqx') },
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('status')).toHaveTextContent('No entity name holds "zzqx".');
    await expect(canvas.queryByRole('list', { name: 'Matches' })).toBeNull();
  },
};
