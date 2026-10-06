// The providers a document may name, read once and held. A provider is added by a migration and
// never by a screen, so the list does not change while a page is open.

import { z } from 'zod';

import { documentProvider } from '@/contract/api/DocumentProvider';

import { readRows } from './http';
import type { DocumentProvider } from './model';
import { readOnce } from './once';

const stated = (column: string): { error: string } => ({
  error: `the column ${column} does not carry a value the base table permits`,
});

// The generated contract states every column nullable, and the base table declares all three
// NOT NULL.
const providerRow = documentProvider.and(
  z.object({
    id: z.string(stated('document_provider.id')),
    name: z.string(stated('document_provider.name')),
    licence: z.string(stated('document_provider.licence')),
  }),
);

const ORDER: Intl.Collator = new Intl.Collator('en');

export const loadProviders = readOnce<readonly DocumentProvider[]>(async () => {
  const rows = await readRows('document_provider');
  return rows
    .map((row) => {
      const read = providerRow.parse(row);
      return { id: read.id, name: read.name, licence: read.licence };
    })
    .sort((one, other) => ORDER.compare(one.name, other.name));
}).load;
