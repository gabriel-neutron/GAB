import { z } from 'zod';

import { duplicateIdentifiers, UNIQUE_KEYS } from './duplicate-identifier.ts';
import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const HOLDERS = `SELECT id::text AS id, label, type, attrs
  FROM api.entity
  WHERE attrs ?| $1::text[]
  ORDER BY id`;

// A new entity that waits in the review queue: its proposal id is its entity id. Its attributes
// are the attributes of the act, in the same form as a row of the record.
const PENDING_HOLDERS = `SELECT id::text AS id, payload->>'label' AS label, payload->>'type' AS type,
    payload->'attrs' AS attrs
  FROM api.proposal
  WHERE status = 'pending' AND op = 'create_entity' AND payload->'attrs' ?| $1::text[]
  ORDER BY id`;

const holder = z.object({
  id: z.uuid(),
  label: z.string(),
  type: z.string(),
  attrs: z.record(z.string(), z.object({ v: z.unknown() })),
});

const pendingHolder = holder.extend({ label: z.string().nullable(), type: z.string().nullable() });

export const readDuplicateIdentifiers = defineTool({
  name: 'read_duplicate_identifiers',
  description:
    'Lists the groups of two or more entities that hold the same value of an INN (tax_id), an ' +
    'OGRN (registration_number), an IMO number (imo), an IMO company number (imo_company_number) ' +
    'or a LEI (lei), whatever their type. One ' +
    'group is one thing recorded twice, or a wrong value, and it splits the chain of ownership. ' +
    'It reads the record and the new entities that wait in the review queue (pending: true), so ' +
    'a copy that was sent twice is found. It flags and never merges: send each group to a ' +
    'reviewer. Two vessels ' +
    'with one name and two IMO numbers are not a group.',
  input: z.strictObject({}),
  output: z.strictObject({
    groups: z.array(
      z.strictObject({
        key: z.string(),
        value: z.string(),
        entities: z.array(
          z.strictObject({
            id: z.uuid(),
            label: z.string(),
            type: z.string(),
            pending: z.literal(true).optional(),
          }),
        ),
      }),
    ),
  }),
  async run(session) {
    const rows = await rowsOf(session, holder, HOLDERS, [[...UNIQUE_KEYS]]);
    const waiting = await rowsOf(session, pendingHolder, PENDING_HOLDERS, [[...UNIQUE_KEYS]]);
    return {
      groups: duplicateIdentifiers([
        ...rows,
        ...waiting.map((one) => ({
          ...one,
          label: one.label ?? '',
          type: one.type ?? '',
          pending: true,
        })),
      ]),
    };
  },
});
