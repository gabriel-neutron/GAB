import { IDENTIFIER_KEYS } from '@gab/proposal/identifiers';
import { z } from 'zod';

import { rowsOf } from './fields.ts';
import { defineTool } from './tool.ts';

const ENTITY_TYPES = `SELECT key, label FROM api.entity_type WHERE NOT retired ORDER BY ord, key`;

const RELATION_TYPES = `SELECT key, label, inverse_label, takes_interval
  FROM api.relation_type WHERE NOT retired ORDER BY key`;

const entityType = z.strictObject({ key: z.string(), label: z.string() });

const relationRow = z.strictObject({
  key: z.string(),
  label: z.string(),
  inverse_label: z.string(),
  takes_interval: z.boolean(),
});

export const listVocabulary = defineTool({
  name: 'list_vocabulary',
  description:
    'Lists the words of the record: the live entity types, the live relation types, and the ' +
    'identifier keys of each entity type. A relation type gives the words that read it from its ' +
    'source and from its far end, and says whether it takes the dates validFrom and validTo. ' +
    'Use these keys in a proposal and in search_graph, and do not make up a new one.',
  input: z.strictObject({}),
  output: z.strictObject({
    entityTypes: z.array(entityType),
    relationTypes: z.array(
      z.strictObject({
        key: z.string(),
        label: z.string(),
        inverseLabel: z.string(),
        takesInterval: z.boolean(),
      }),
    ),
    identifierKeys: z.record(z.string(), z.array(z.string())),
  }),
  async run(session) {
    const entityTypes = await rowsOf(session, entityType, ENTITY_TYPES, []);
    const relations = await rowsOf(session, relationRow, RELATION_TYPES, []);
    return {
      entityTypes,
      relationTypes: relations.map((held) => ({
        key: held.key,
        label: held.label,
        inverseLabel: held.inverse_label,
        takesInterval: held.takes_interval,
      })),
      identifierKeys: Object.fromEntries(
        Object.entries(IDENTIFIER_KEYS).map(([type, keys]) => [type, [...keys]]),
      ),
    };
  },
});
