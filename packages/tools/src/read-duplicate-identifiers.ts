import { z } from 'zod';

import { duplicateIdentifiers, UNIQUE_KEYS } from './duplicate-identifier.ts';
import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const HOLDERS = `SELECT id::text AS id, label, type, attrs
  FROM api.entity
  WHERE attrs ?| $1::text[]
  ORDER BY id`;

const holder = z.object({
  id: z.uuid(),
  label: z.string(),
  type: z.string(),
  attrs: z.record(z.string(), z.object({ v: z.unknown() })),
});

export const readDuplicateIdentifiers = defineTool({
  name: 'read_duplicate_identifiers',
  description:
    'Lists the groups of two or more entities that hold the same value of an INN (tax_id), an ' +
    'OGRN (registration_number), an IMO number (imo) or a LEI (lei), whatever their type. One ' +
    'group is one thing recorded twice, or a wrong value, and it splits the chain of ownership. ' +
    'It reads the record, flags and never merges: send each group to a reviewer. Two vessels ' +
    'with one name and two IMO numbers are not a group.',
  input: z.strictObject({}),
  output: z.strictObject({
    groups: z.array(
      z.strictObject({
        key: z.string(),
        value: z.string(),
        entities: z.array(z.strictObject({ id: z.uuid(), label: z.string(), type: z.string() })),
      }),
    ),
  }),
  async run(session) {
    const rows = await rowsOf(session, holder, HOLDERS, [[...UNIQUE_KEYS]]);
    return { groups: duplicateIdentifiers(rows) };
  },
});
