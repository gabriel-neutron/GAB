import { z } from 'zod';

import { readRegister, storeRegister } from './register-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { webFromReach } from './web-access.ts';

const ENDPOINT = 'https://query.wikidata.org/sparql';

// External constraint: the Wikidata property of each identifier, read from Wikidata on
// 6 October 2026.
const PROPERTY = {
  lei: 'P1278',
  ogrn: 'P7011',
  cin: 'P10183',
  imo: 'P458',
  companyNumber: 'P2622',
} as const;

type Field = keyof typeof PROPERTY;

const FIELDS = Object.keys(PROPERTY) as [Field, ...Field[]];

// The value goes into the text of the query, so it holds only the characters of an identifier. A
// quote or a brace can never reach the query.
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9 ./-]{0,99}$/u;

const QID = /^Q[1-9][0-9]{0,11}$/u;

const MAX_ROWS = 200;

const queryOf = (subject: string): string =>
  [
    `SELECT ?item ?itemLabel ${FIELDS.map((field) => `?${field}`).join(' ')} WHERE {`,
    `  ${subject}`,
    ...FIELDS.map((field) => `  OPTIONAL { ?item wdt:${PROPERTY[field]} ?${field} . }`),
    '  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,mul,ru". }',
    `} LIMIT ${MAX_ROWS}`,
  ].join('\n');

const binding = z.object({ value: z.string() }).optional();

const sparqlAnswer = z.object({
  results: z.object({
    bindings: z.array(
      z.object({
        item: z.object({ value: z.string() }),
        itemLabel: binding,
        lei: binding,
        ogrn: binding,
        cin: binding,
        imo: binding,
        companyNumber: binding,
      }),
    ),
  }),
});

const identifiers = Object.fromEntries(
  FIELDS.map((field) => [field, z.array(z.string())]),
) as Record<Field, z.ZodArray<z.ZodString>>;

const outputShape = z.strictObject({
  document: z.string().nullable(),
  status: z.enum(['known', 'stored']).nullable(),
  items: z.array(z.strictObject({ qid: z.string(), label: z.string(), ...identifiers })),
});

export const wikidataIds = defineTool({
  name: 'wikidata_ids',
  description:
    'Gives the identifiers that Wikidata holds for one item: LEI, OGRN, the Indian CIN, the ' +
    'IMO number and the UK company number. Wikidata is free and needs no key. With a qid, it ' +
    'reads that one item and stores the answer once as an api document. With a key and a ' +
    'value, such as {"key": "lei", "value": "21380068P1DRHMJ8KU70"}, it lists the items that ' +
    'hold the value: the list is a lead and nothing is stored, so call it again with the qid ' +
    'that you choose.',
  input: z.strictObject({
    qid: z
      .string()
      .trim()
      .toUpperCase()
      .regex(QID, 'a qid is Q and digits')
      .optional()
      .describe('The Wikidata item to read. Give a qid, or a key and a value.'),
    key: z.enum(FIELDS).optional().describe('The kind of identifier in value.'),
    value: z
      .string()
      .trim()
      .regex(IDENTIFIER, 'a value is the letters of an identifier')
      .optional()
      .describe('The identifier to look up. It needs a key.'),
  }),
  output: outputShape,
  async run(session, input, reach) {
    const web = webFromReach(reach);
    const byQid = input.qid !== undefined;
    if (
      byQid
        ? input.key !== undefined || input.value !== undefined
        : input.key === undefined || input.value === undefined
    )
      throw new ToolRefusal('give a key and a value, or a qid');
    const subject =
      input.qid === undefined
        ? `?item wdt:${PROPERTY[input.key ?? 'lei']} "${input.value ?? ''}" .`
        : `VALUES ?item { wd:${input.qid} }`;
    const query = new URLSearchParams({ query: queryOf(subject), format: 'json' });
    const request = {
      url: `${ENDPOINT}?${query.toString()}`,
      register: 'Wikidata',
      headers: { accept: 'application/sparql-results+json' },
    };
    const answer = await readRegister(web, request);
    if (answer === null) throw new ToolRefusal('Wikidata holds no answer for this query');
    const found = sparqlAnswer.safeParse(answer.json);
    if (!found.success)
      throw new ToolRefusal('Wikidata gave an answer that this tool does not read');

    // One row comes back for each mix of values, so the rows of one item are merged.
    const items = new Map<string, z.input<typeof outputShape>['items'][number]>();
    for (const row of found.data.results.bindings) {
      const qid = row.item.value.split('/').at(-1) ?? row.item.value;
      const item = items.get(qid) ?? {
        qid,
        label: row.itemLabel?.value ?? qid,
        lei: [],
        ogrn: [],
        cin: [],
        imo: [],
        companyNumber: [],
      };
      for (const field of FIELDS) {
        const value = row[field]?.value;
        if (value !== undefined && !item[field].includes(value)) item[field].push(value);
      }
      items.set(qid, item);
    }
    if (!byQid) return { document: null, status: null, items: [...items.values()] };
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no answer');
    const title = `Wikidata identifiers of ${input.qid ?? ''}`;
    const stored = await storeRegister(session, reach, { ...request, title }, answer);
    return { document: stored.document, status: stored.status, items: [...items.values()] };
  },
});
