import { z } from 'zod';

import { readRegister, shaped, storeRegister } from './register-answer.ts';
import { defineTool, type Reach, type Session, ToolRefusal } from './tool.ts';
import { webFromReach } from './web-access.ts';

const BASE = 'https://api.gleif.org/api/v1';
const ACCEPT = { accept: 'application/vnd.api+json' };
const LEI = /^[A-Z0-9]{18}[0-9]{2}$/u;
const MAX_LEADS = 10;

const LEVELS = ['direct', 'ultimate'] as const;

const links = z.record(z.string(), z.string());

const entity = z.object({
  legalName: z.object({ name: z.string() }),
  jurisdiction: z.string().nullish(),
});

const leiRecord = z.object({
  data: z.object({
    attributes: z.object({ lei: z.string(), entity }),
    relationships: z.record(z.string(), z.object({ links: links.optional() })).optional(),
  }),
});

const relationship = z.object({
  data: z.object({
    attributes: z.object({ relationship: z.object({ endNode: z.object({ id: z.string() }) }) }),
  }),
});

const leadList = z.object({
  data: z.array(z.object({ attributes: z.object({ lei: z.string(), entity }) })),
});

const stored = z.enum(['known', 'stored']);

const outputShape = z.strictObject({
  notices: z.array(z.string()),
  record: z
    .strictObject({
      lei: z.string(),
      legalName: z.string(),
      document: z.string(),
      status: stored,
      parents: z.array(
        z.strictObject({
          level: z.enum(LEVELS),
          kind: z.enum(['relationship', 'exception']),
          document: z.string(),
          status: stored,
          parentLei: z.string().nullable(),
        }),
      ),
    })
    .nullable(),
  leads: z.array(
    z.strictObject({ lei: z.string(), legalName: z.string(), jurisdiction: z.string().nullable() }),
  ),
});

type Output = z.input<typeof outputShape>;

const leadsOf = async (reach: Reach, name: string): Promise<Output> => {
  const query = new URLSearchParams({ 'filter[fulltext]': name, 'page[size]': String(MAX_LEADS) });
  const answer = await readRegister(webFromReach(reach), {
    url: `${BASE}/lei-records?${query.toString()}`,
    register: 'GLEIF',
    headers: ACCEPT,
  });
  if (answer === null) throw new ToolRefusal('GLEIF holds no list for this name');
  return {
    notices: [],
    record: null,
    leads: shaped('GLEIF', leadList, answer.json).data.map(({ attributes }) => ({
      lei: attributes.lei,
      legalName: attributes.entity.legalName.name,
      jurisdiction: attributes.entity.jurisdiction ?? null,
    })),
  };
};

const recordOf = async (session: Session, reach: Reach, lei: string): Promise<Output> => {
  const web = webFromReach(reach);
  const read = async (url: string, title: string) => {
    const request = { url, register: 'GLEIF', headers: ACCEPT };
    const answer = await readRegister(web, request);
    if (answer === null) return null;
    return { answer, ...(await storeRegister(session, reach, { ...request, title }, answer)) };
  };

  const held = await read(`${BASE}/lei-records/${lei}`, `GLEIF LEI record ${lei}`);
  if (held === null) throw new ToolRefusal(`GLEIF holds no record of ${lei}`);
  const { data } = shaped('GLEIF', leiRecord, held.answer.json);

  const notices: string[] = [];
  const parents: NonNullable<Output['record']>['parents'] = [];
  for (const level of LEVELS) {
    const given = data.relationships?.[`${level}-parent`]?.links ?? {};
    // A link is followed only inside GLEIF, so an answer cannot send the tool to another host.
    const kind = given['relationship-record'] === undefined ? 'exception' : 'relationship';
    const url = given['relationship-record'] ?? given['reporting-exception'];
    if (url === undefined) continue;
    if (!url.startsWith(`${BASE}/`)) {
      notices.push(
        `the ${level} parent link was not followed: it is not an https address of GLEIF`,
      );
      continue;
    }
    const part = await read(url, `GLEIF ${level} parent ${kind} of ${lei}`);
    if (part === null)
      throw new ToolRefusal(`GLEIF gave a link for the ${level} parent of ${lei} and no answer`);
    parents.push({
      level,
      kind,
      document: part.document,
      status: part.status,
      parentLei:
        kind === 'exception'
          ? null
          : shaped('GLEIF', relationship, part.answer.json).data.attributes.relationship.endNode.id,
    });
  }
  return {
    notices,
    record: {
      lei: data.attributes.lei,
      legalName: data.attributes.entity.legalName.name,
      document: held.document,
      status: held.status,
      parents,
    },
    leads: [],
  };
};

export const gleifLookup = defineTool({
  name: 'gleif_lookup',
  description:
    'Reads one LEI in GLEIF, which is free and needs no key. It stores the LEI record and the ' +
    'answer for the direct and the ultimate parent, each once as an api document, and gives ' +
    'the document ids, the legal name and the LEI of each parent. A parent that GLEIF does not ' +
    'name has an exception answer, and its parentLei is null. Call it again with the LEI of a ' +
    'parent to read that parent. A parent link that is not an https address of GLEIF is not ' +
    'followed, and "notices" says so. With a name instead of an LEI, it returns a list of leads ' +
    'and stores nothing: read the LEI that you choose.',
  input: z.strictObject({
    lei: z
      .string()
      .trim()
      .toUpperCase()
      .regex(LEI, 'an LEI is 20 letters and digits')
      .optional()
      .describe('The LEI to read. Give an lei or a name, and not both.'),
    name: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .optional()
      .describe('A name to search. It gives leads and stores nothing.'),
  }),
  output: outputShape,
  async run(session, input, reach) {
    if ((input.lei === undefined) === (input.name === undefined))
      throw new ToolRefusal('give an lei or a name, and not both');
    if (input.lei === undefined)
      return leadsOf(reach ?? { now: () => new Date() }, input.name ?? '');
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no answer');
    return recordOf(session, reach, input.lei);
  },
});
