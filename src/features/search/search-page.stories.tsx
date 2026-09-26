import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';

import { searchByAttributeValue } from './attribute-search';
import { searchByDocument } from './document-search';
import { searchByName } from './name-search';
import { SearchPage } from './search-page';

const onQueryChange = fn();

const hrefOf = (entityId: string): string => `/entity/${encodeURIComponent(entityId)}`;

const answersFor = (query: string) => ({
  query,
  nameAnswer: searchByName(corpus.entities, query),
  attributeAnswer: searchByAttributeValue(corpus.entities, query),
  documentAnswer: searchByDocument(corpus.documents, query),
});

const meta = {
  component: SearchPage,
  args: {
    ...answersFor('northern ledger'),
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
    await expect(canvas.getAllByRole('status')[0]).toHaveTextContent('entity names hold');
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
  args: answersFor(''),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')[0]).toHaveTextContent('Type a part of a name.');
    await expect(canvas.queryByRole('list', { name: 'Matches' })).toBeNull();
  },
};

/** A query that finds nothing says so in words, and it draws no list. */
export const NoMatchIsStated: Story = {
  args: answersFor('zzqx'),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')[0]).toHaveTextContent(
      'No entity name holds "zzqx".',
    );
    await expect(canvas.queryByRole('list', { name: 'Matches' })).toBeNull();
  },
};

/** An attribute hit names the entity, the attribute key and the value that matched, and it
 * opens the same entity page a name hit would. */
export const AnAttributeMatchNamesTheKeyAndTheEntity: Story = {
  args: answersFor('director'),
  play: async ({ canvas }) => {
    const hit = canvas.getByRole('link', { name: /role_title/ });
    await expect(hit).toHaveAttribute('href', expect.stringMatching(/^\/entity\//));
  },
};

/** A document hit with an address opens that address; a document with none draws as text and
 * offers no link, matching the source card's own rule for a missing address. */
export const ADocumentMatchOpensItsAddress: Story = {
  args: answersFor('rotterdam'),
  play: async ({ canvas }) => {
    const hit = canvas.getByRole('link', { name: /Port of Rotterdam/ });
    await expect(hit).toHaveAttribute('href', 'https://example.invalid/rotterdam/q2-2026.pdf');
  },
};
