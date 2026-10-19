import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { corpus } from '@/shared/committed-fixture/corpus';

import { searchByAttributeValue } from './attribute-search';
import { searchByDocument } from './document-search';
import { searchByName } from './name-search';
import { ReadingPage } from '@/shared/page/reading-page';
import { PageHeader } from '@/shared/page/page-header';

import { SearchPage } from './search-page';

const onQueryChange = fn();

const hrefOf = (entityId: string): string => `/entity/${encodeURIComponent(entityId)}`;

const answersFor = (query: string) => ({
  query,
  answers: {
    name: searchByName(corpus.entities, query),
    attribute: searchByAttributeValue(corpus.entities, query),
    document: searchByDocument(corpus.documents, query),
  },
});

const meta = {
  component: SearchPage,
  args: {
    ...answersFor('northern ledger'),
    onQueryChange,
    hrefOf,
  },
  parameters: { layout: 'fullscreen' },
  // The route gives the frame of the page: the page shows no title of its own.
  decorators: [
    (Story) => (
      <div className="h-svh">
        <ReadingPage>
          <PageHeader title="Search" />
          <Story />
        </ReadingPage>
      </div>
    ),
  ],
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
    await expect(canvas.getByRole('table', { name: 'Entity names' })).toBeVisible();
  },
};

/** The field reports each keystroke to the caller, and it holds no query of its own. */
export const TypingIsAnnouncedToTheCaller: Story = {
  play: async ({ canvas }) => {
    onQueryChange.mockClear();
    await userEvent.type(canvas.getByRole('searchbox', { name: 'Search text' }), 'x');
    await expect(onQueryChange).toHaveBeenCalledWith('northern ledgerx');
  },
};

/** An empty field states what to do and how large the corpus is, and it draws no list. */
export const AnEmptyFieldAsksForAName: Story = {
  args: answersFor(''),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')[0]).toHaveTextContent('Type a part of a name.');
    await expect(canvas.queryByRole('table', { name: 'Entity names' })).toBeNull();
  },
};

/** Each of the three answers states its own empty case in one sentence, and none draws a table. */
export const EachAnswerStatesItsOwnEmptyCase: Story = {
  args: answersFor('zzqx'),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')).toHaveLength(3);
    await expect(canvas.getByText('No attribute value holds "zzqx".')).toBeVisible();
    await expect(canvas.getByText('No document title holds "zzqx".')).toBeVisible();
    await expect(canvas.queryAllByRole('table')).toHaveLength(0);
  },
};

/** A query that finds nothing says so in words, and it draws no list. */
export const NoMatchIsStated: Story = {
  args: answersFor('zzqx'),
  play: async ({ canvas }) => {
    await expect(canvas.getAllByRole('status')[0]).toHaveTextContent(
      'No entity name holds "zzqx".',
    );
    await expect(canvas.queryByRole('table', { name: 'Entity names' })).toBeNull();
  },
};

/** An attribute hit names the entity, the attribute key and the value that matched, and it
 * opens the same entity page a name hit would. */
export const AnAttributeMatchNamesTheKeyAndTheEntity: Story = {
  args: answersFor('director'),
  play: async ({ canvas }) => {
    const key = canvas.getAllByRole('cell', { name: 'role_title' })[0];
    const row = key?.closest('tr') ?? null;
    if (row === null) throw new Error('The attribute table holds no row for role_title');
    await expect(row).toHaveTextContent(/director/i);
    const hit = within(row).getByRole('link');
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
