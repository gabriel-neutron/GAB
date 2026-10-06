import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { defineTool, ToolRefusal } from './tool.ts';

// A hub such as a flag state holds hundreds of relations, and a model reads the whole answer.
// The cap keeps one answer readable, and the neighbourhood tool walks further.
const MAX_RELATIONS = 200;

const ENTITY = `SELECT id::text AS id, type, label, attrs, sources::text[] AS sources
  FROM api.entity WHERE id = $1::uuid`;

// A relation is stored in one direction. The label of its type reads it from its source, and the
// inverse label reads it from its far end, so each row comes with the words that read it from the
// entity asked for.
const RELATIONS = `SELECT r.id::text AS id, r.type, d.direction,
         CASE WHEN d.direction = 'out' THEN t.label ELSE t.inverse_label END AS reads,
         o.kind AS other_kind, o.id::text AS other_id, e.label AS other_label, e.type AS other_type,
         r.valid_from::text AS valid_from, r.valid_to::text AS valid_to, r.attrs,
         r.sources::text[] AS sources
    FROM api.relation r
   CROSS JOIN LATERAL (SELECT CASE WHEN r.src_kind = 'entity' AND r.src_id = $1::uuid
                                   THEN 'out' ELSE 'in' END AS direction) d
   CROSS JOIN LATERAL (SELECT CASE WHEN d.direction = 'out' THEN r.dst_kind ELSE r.src_kind END
                                AS kind,
                              CASE WHEN d.direction = 'out' THEN r.dst_id ELSE r.src_id END
                                AS id) o
    LEFT JOIN api.relation_type t ON t.key = r.type
    LEFT JOIN api.entity e ON o.kind = 'entity' AND e.id = o.id
   WHERE (r.src_kind = 'entity' AND r.src_id = $1::uuid)
      OR (r.dst_kind = 'entity' AND r.dst_id = $1::uuid)
   ORDER BY r.type, e.label, r.id
   LIMIT $2::int`;

const DOCUMENTS = `SELECT id::text AS id, title, uri FROM api.document
  WHERE id = ANY($1::text[]) ORDER BY id`;

const attribute = z.object({ v: z.unknown(), src: z.array(z.string()) });

const attributes = z.record(z.string(), attribute);

const entityRow = z.strictObject({
  id: z.uuid(),
  type: z.string(),
  label: z.string(),
  attrs: attributes,
  sources: z.array(z.string()),
});

const relationRow = z.strictObject({
  id: z.uuid(),
  type: z.string(),
  direction: z.enum(['out', 'in']),
  reads: z.string().nullable(),
  other_kind: z.enum(['entity', 'relation']),
  other_id: z.uuid(),
  other_label: z.string().nullable(),
  other_type: z.string().nullable(),
  valid_from: z.string().nullable(),
  valid_to: z.string().nullable(),
  attrs: attributes,
  sources: z.array(z.string()),
});

const documentRow = z.strictObject({
  id: z.string(),
  title: z.string(),
  uri: z.string().nullable(),
});

const relation = z.strictObject({
  id: z.uuid(),
  type: z.string(),
  direction: z.enum(['out', 'in']),
  reads: z.string().nullable(),
  other: z.strictObject({
    kind: z.enum(['entity', 'relation']),
    id: z.uuid(),
    label: z.string().nullable(),
    type: z.string().nullable(),
  }),
  validFrom: z.string().nullable(),
  validTo: z.string().nullable(),
  attrs: attributes,
  sources: z.array(z.string()),
});

const citedBy = (attrs: z.output<typeof attributes>): string[] =>
  Object.values(attrs).flatMap((held) => held.src);

export const readEntity = defineTool({
  name: 'read_entity',
  description:
    'Reads one entity of the record: its type, its name, its attributes with the documents that ' +
    'hold up each value, its relations, and its sources. Each relation gives its type, the words ' +
    'that read it from this entity, its direction (out when this entity is the source), the ' +
    `other end, its dates and its sources. At most ${MAX_RELATIONS} relations come back, and ` +
    '"truncated" says that more exist. "documents" gives the title and the address of each ' +
    'document that the answer cites.',
  input: z.strictObject({ entity: z.uuid().describe('the id of the entity') }),
  output: z.strictObject({
    id: z.uuid(),
    type: z.string(),
    label: z.string(),
    attrs: attributes,
    sources: z.array(z.string()),
    relations: z.array(relation),
    truncated: z.boolean(),
    documents: z.array(
      z.strictObject({ id: z.string(), title: z.string(), url: z.string().nullable() }),
    ),
  }),
  async run(session, input) {
    const [held] = await rowsOf(session, entityRow, ENTITY, [input.entity]);
    if (held === undefined) throw new ToolRefusal(`the record holds no entity ${input.entity}`);
    const found = await rowsOf(session, relationRow, RELATIONS, [input.entity, MAX_RELATIONS + 1]);
    const relations = found.slice(0, MAX_RELATIONS);
    const cited = new Set([
      ...held.sources,
      ...citedBy(held.attrs),
      ...relations.flatMap((row) => [...row.sources, ...citedBy(row.attrs)]),
    ]);
    const documents = await rowsOf(session, documentRow, DOCUMENTS, [[...cited]]);
    return {
      ...held,
      relations: relations.map((row) => ({
        id: row.id,
        type: row.type,
        direction: row.direction,
        reads: row.reads,
        other: {
          kind: row.other_kind,
          id: row.other_id,
          label: row.other_label,
          type: row.other_type,
        },
        validFrom: row.valid_from,
        validTo: row.valid_to,
        attrs: row.attrs,
        sources: row.sources,
      })),
      truncated: found.length > MAX_RELATIONS,
      documents: documents.map((row) => ({ id: row.id, title: row.title, url: row.uri })),
    };
  },
});
