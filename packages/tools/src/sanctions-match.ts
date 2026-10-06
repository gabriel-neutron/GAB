import { isValidImo } from '@gab/proposal/identifiers';
import { z } from 'zod';

import { readRegister, shaped, storeRegister, type RegisterRequest } from './register-answer.ts';
import { defineTool, type Reach, type Session, ToolRefusal } from './tool.ts';
import { webFromReach } from './web-access.ts';

const BASE = 'https://api.opensanctions.org';
// External constraint: the dataset of OpenSanctions that joins every list.
const DATASET = 'default';
const MAX_LEADS = 10;
const ENTITY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/u;
const SCHEMAS = ['Vessel', 'Company', 'Organization', 'LegalEntity', 'Person'] as const;

// OpenSanctions joins the official lists and republishes them. A claim that cites the repeater
// cites a copy, so the output sends the reader to the official entry each time.
export const REPEATER_SENTENCE =
  'OpenSanctions is a repeater: a claim must cite the official entry after fetch_document stores it.' as const;

const words = z.array(z.unknown()).default([]);

const entityAnswer = z.object({
  id: z.string(),
  caption: z.string(),
  schema: z.string(),
  datasets: z.array(z.string()).default([]),
  properties: z.object({ sanctions: words }).loose().default({ sanctions: [] }),
});

const sanction = z.object({
  schema: z.literal('Sanction'),
  properties: z.record(z.string(), words).default({}),
});

const leadList = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      caption: z.string(),
      schema: z.string(),
      datasets: z.array(z.string()).default([]),
    }),
  ),
});

const outputShape = z.strictObject({
  entity: z
    .strictObject({
      id: z.string(),
      caption: z.string(),
      schema: z.string(),
      datasets: z.array(z.string()),
      document: z.string(),
      status: z.enum(['known', 'stored']),
      entries: z.array(
        z.strictObject({ authority: z.string().nullable(), sourceUrl: z.string().nullable() }),
      ),
    })
    .nullable(),
  leads: z.array(
    z.strictObject({
      id: z.string(),
      caption: z.string(),
      schema: z.string(),
      datasets: z.array(z.string()),
    }),
  ),
  repeater: z.literal(REPEATER_SENTENCE),
});

type Output = z.input<typeof outputShape>;

const firstText = (values: readonly unknown[] | undefined): string | null => {
  const found = values?.find((value): value is string => typeof value === 'string');
  return found === undefined || found.trim() === '' ? null : found;
};

const requestOf = (key: string, url: string): RegisterRequest => ({
  url,
  register: 'OpenSanctions',
  headers: { accept: 'application/json', authorization: `ApiKey ${key}` },
});

const leadsOf = async (reach: Reach, key: string, query: URLSearchParams): Promise<Output> => {
  query.set('limit', String(MAX_LEADS));
  const answer = await readRegister(
    webFromReach(reach),
    requestOf(key, `${BASE}/search/${DATASET}?${query.toString()}`),
  );
  if (answer === null) throw new ToolRefusal('OpenSanctions holds no list for this search');
  return {
    entity: null,
    leads: shaped('OpenSanctions', leadList, answer.json).results,
    repeater: REPEATER_SENTENCE,
  };
};

const entityOf = async (
  session: Session,
  reach: Reach,
  key: string,
  id: string,
): Promise<Output> => {
  const request = requestOf(key, `${BASE}/entities/${encodeURIComponent(id)}?nested=true`);
  const answer = await readRegister(webFromReach(reach), request);
  if (answer === null) throw new ToolRefusal(`OpenSanctions holds no entity ${id}`);
  const held = shaped('OpenSanctions', entityAnswer, answer.json);
  const stored = await storeRegister(
    session,
    reach,
    { ...request, title: `OpenSanctions entity ${held.id}: ${held.caption}` },
    answer,
  );
  const entries = held.properties.sanctions.flatMap((value) => {
    const found = sanction.safeParse(value);
    if (!found.success) return [];
    const sourceUrl = firstText(found.data.properties['sourceUrl']);
    return sourceUrl === null
      ? []
      : [{ authority: firstText(found.data.properties['authority']), sourceUrl }];
  });
  return {
    entity: {
      id: held.id,
      caption: held.caption,
      schema: held.schema,
      datasets: held.datasets,
      document: stored.document,
      status: stored.status,
      entries,
    },
    leads: [],
    repeater: REPEATER_SENTENCE,
  };
};

export const sanctionsMatch = defineTool({
  name: 'sanctions_match',
  description:
    'Reads the sanctions lists that OpenSanctions joins. It needs a key, and it refuses and ' +
    'names the setting when the key is not set. With an entityId it reads that one entity, ' +
    'stores the answer once as an api document, and gives the document id, the datasets and ' +
    'the address of each official entry. With an imo number, or a name and a schema, it ' +
    'returns a list of leads and stores nothing: read the entity that you choose. ' +
    'OpenSanctions is a repeater: store the official entry with fetch_document and cite that.',
  input: z
    .strictObject({
      entityId: z
        .string()
        .trim()
        .regex(ENTITY_ID, 'an entityId is the id that OpenSanctions gives, such as NK-abc123')
        .optional()
        .describe('The OpenSanctions id of the entity to read.'),
      imo: z
        .string()
        .trim()
        .regex(/^(IMO\s*)?\d{7}$/iu, 'an IMO number is seven digits')
        .transform((value) => value.replace(/^IMO\s*/iu, ''))
        .optional()
        .describe('The IMO number of a vessel to search. It gives leads.'),
      name: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .optional()
        .describe('A name to search, with its schema. It gives leads.'),
      schema: z.enum(SCHEMAS).optional().describe('The kind of entity that a name names.'),
    })
    .refine(
      (input) =>
        [input.entityId, input.imo, input.name].filter((value) => value !== undefined).length === 1,
      { error: 'give one of an entityId, an imo or a name' },
    )
    .refine((input) => input.name === undefined || input.schema !== undefined, {
      error: 'a name needs its schema, such as Vessel, Company or Person',
    }),
  output: outputShape,
  async run(session, input, reach) {
    const key = webFromReach(reach).openSanctionsKey ?? '';
    if (key === '')
      throw new ToolRefusal(
        'sanctions_match needs a key: set OPENSANCTIONS_API_KEY in the research workspace',
      );
    if (input.entityId !== undefined) {
      if (reach?.store === undefined)
        throw new ToolRefusal('this surface gives no object store, so it stores no answer');
      return entityOf(session, reach, key, input.entityId);
    }
    if (input.imo !== undefined) {
      if (!isValidImo(input.imo))
        throw new ToolRefusal(`${input.imo} fails the IMO check digit, so it is not an IMO number`);
      return leadsOf(
        reach ?? { now: () => new Date() },
        key,
        new URLSearchParams({ q: input.imo, schema: 'Vessel' }),
      );
    }
    return leadsOf(
      reach ?? { now: () => new Date() },
      key,
      new URLSearchParams({ q: input.name ?? '', schema: input.schema ?? 'Thing' }),
    );
  },
});
