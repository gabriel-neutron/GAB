import { z } from 'zod';

import { readRegister, shaped, storeRegister, type RegisterRequest } from './register-answer.ts';
import { defineTool, type Reach, type Session, ToolRefusal } from './tool.ts';
import { webFromReach } from './web-access.ts';

const BASE = 'https://api.company-information.service.gov.uk';
const COMPANY_NUMBER = /^[A-Z0-9]{8}$/u;
const MAX_LEADS = 10;

const PARTS = [
  ['profile', ''],
  ['officers', '/officers'],
  ['control', '/persons-with-significant-control'],
  ['charges', '/charges'],
] as const;

const profile = z.object({
  company_number: z.string(),
  company_name: z.string(),
  company_status: z.string().nullish(),
});

const leadList = z.object({
  items: z
    .array(
      z.object({
        company_number: z.string(),
        title: z.string(),
        company_status: z.string().nullish(),
      }),
    )
    .default([]),
});

const outputShape = z.strictObject({
  record: z
    .strictObject({
      companyNumber: z.string(),
      name: z.string(),
      companyStatus: z.string().nullable(),
      documents: z.array(
        z.strictObject({
          part: z.enum(['profile', 'officers', 'control', 'charges']),
          document: z.string().nullable(),
          status: z.enum(['known', 'stored', 'none']),
        }),
      ),
    })
    .nullable(),
  leads: z.array(
    z.strictObject({
      companyNumber: z.string(),
      title: z.string(),
      companyStatus: z.string().nullable(),
    }),
  ),
});

type Output = z.input<typeof outputShape>;

// The key is the user name of Basic authentication, with no password.
const requestOf = (key: string, url: string): RegisterRequest => ({
  url,
  register: 'Companies House',
  headers: {
    accept: 'application/json',
    authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`,
  },
});

const leadsOf = async (reach: Reach, key: string, name: string): Promise<Output> => {
  const query = new URLSearchParams({ q: name, items_per_page: String(MAX_LEADS) });
  const answer = await readRegister(
    webFromReach(reach),
    requestOf(key, `${BASE}/search/companies?${query.toString()}`),
  );
  if (answer === null) throw new ToolRefusal('Companies House holds no list for this name');
  return {
    record: null,
    leads: shaped('Companies House', leadList, answer.json).items.map((item) => ({
      companyNumber: item.company_number,
      title: item.title,
      companyStatus: item.company_status ?? null,
    })),
  };
};

const recordOf = async (
  session: Session,
  reach: Reach,
  key: string,
  number: string,
): Promise<Output> => {
  const web = webFromReach(reach);
  const documents: NonNullable<Output['record']>['documents'] = [];
  let held: z.output<typeof profile> | undefined;
  for (const [part, path] of PARTS) {
    const request = requestOf(key, `${BASE}/company/${number}${path}`);
    const answer = await readRegister(web, request);
    if (answer === null) {
      if (part === 'profile') throw new ToolRefusal(`Companies House holds no company ${number}`);
      documents.push({ part, document: null, status: 'none' });
      continue;
    }
    if (part === 'profile') held = shaped('Companies House', profile, answer.json);
    const title = `Companies House ${part} ${number}`;
    const stored = await storeRegister(session, reach, { ...request, title }, answer);
    documents.push({ part, document: stored.document, status: stored.status });
  }
  if (held === undefined) throw new Error('the profile was read and no profile is held');
  return {
    record: {
      companyNumber: held.company_number,
      name: held.company_name,
      companyStatus: held.company_status ?? null,
      documents,
    },
    leads: [],
  };
};

export const companiesHouse = defineTool({
  name: 'companies_house',
  description:
    'Reads one UK company in Companies House by its company number. It stores the profile, ' +
    'the officers, the persons with significant control and the charges, each once as an api ' +
    'document, and gives the document ids with the name and the status of the company. A part ' +
    'that the register does not hold has status "none". The register is free but needs a key: ' +
    'with no key set, the tool refuses and names the setting. With a name instead of a number, ' +
    'it returns a list of leads and stores nothing: read the number that you choose.',
  input: z.strictObject({
    companyNumber: z
      .string()
      .trim()
      .toUpperCase()
      .regex(COMPANY_NUMBER, 'a company number is eight letters and digits')
      .optional()
      .describe('The company number to read. Give a companyNumber or a name, and not both.'),
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
    if ((input.companyNumber === undefined) === (input.name === undefined))
      throw new ToolRefusal('give a companyNumber or a name, and not both');
    const key = webFromReach(reach).companiesHouseKey ?? '';
    if (key === '')
      throw new ToolRefusal(
        'companies_house needs a key: set COMPANIES_HOUSE_API_KEY in the research workspace',
      );
    if (input.companyNumber === undefined)
      return leadsOf(reach ?? { now: () => new Date() }, key, input.name ?? '');
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no answer');
    return recordOf(session, reach, key, input.companyNumber);
  },
});
