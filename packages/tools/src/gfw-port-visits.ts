import { day } from '@gab/proposal/day';
import { z } from 'zod';

import { readRegister, shaped, storeRegister, type RegisterRequest } from './register-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { webFromReach } from './web-access.ts';

const BASE = 'https://gateway.api.globalfishingwatch.org';
const REGISTER = 'Global Fishing Watch';
const DATASET = 'public-global-port-visits-events:latest';

// The largest page that one stored answer holds. A longer window is read with the offset.
const PAGE = 200;

// The terms of the data. The document holds them, so a reader of the document alone sees them.
const LICENCE = 'CC BY-NC 4.0';
const CITATION = 'Global Fishing Watch';
const LIMIT =
  'AIS only: a vessel that switches off its AIS, or that has no AIS in range, is not in this extract.';

const answerShape = z.object({
  entries: z.array(z.unknown()).default([]),
  nextOffset: z.number().int().nullish(),
  total: z.number().int().nullish(),
});

const outputShape = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  events: z.number().int(),
  total: z.number().int().nullable(),
  nextOffset: z.number().int().nullable(),
  licence: z.string(),
  citation: z.string(),
  limit: z.string(),
});

export const gfwPortVisits = defineTool({
  name: 'gfw_port_visits',
  description:
    'Reads the port visit events of Global Fishing Watch for a list of GFW anchorage ids, one ' +
    'vessel type and a fixed date window, and stores the answer as a document: a frozen reference ' +
    'of the vessels seen at those anchorages. The tool needs the free GFW token: with no token ' +
    'set, it refuses and names the setting. The token goes in a header, and the stored address ' +
    'holds none. The document records the licence (CC BY-NC 4.0, non-commercial use), the ' +
    'citation (Global Fishing Watch) and the limit of the data (AIS only). One call stores one ' +
    'page of 200 events: read the next page with nextOffset until it is null. The window holds ' +
    'the day from and excludes the day to.',
  input: z
    .strictObject({
      anchorageIds: z
        .array(
          z
            .string()
            .trim()
            .regex(/^[A-Za-z0-9_-]{2,64}$/u, 'an anchorage id is a GFW id'),
        )
        .min(1)
        .max(100),
      // shortcut: the type name and the portIds filter are not checked against a live answer, so
      // the tool takes any upper case type name. Upgrade after the first live call: check that
      // the stored entries are tankers at the requested anchorages.
      vesselType: z
        .string()
        .trim()
        .regex(/^[A-Z_]{3,30}$/u, 'a vessel type is upper case letters, for example TANKER')
        .default('TANKER'),
      from: day,
      to: day,
      offset: z.number().int().min(0).default(0),
    })
    .refine((input) => input.from < input.to, { error: 'from comes before to' }),
  output: outputShape,
  async run(session, input, reach) {
    const token = webFromReach(reach).gfwToken ?? '';
    if (token === '')
      throw new ToolRefusal(
        'gfw_port_visits needs a token: set GFW_API_TOKEN in the research workspace',
      );
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no answer');

    // Sorted, so the same set of anchorages in any order is one address and one document.
    const anchorages = [...new Set(input.anchorageIds)].sort();
    const query = new URLSearchParams();
    query.set('datasets[0]', DATASET);
    query.set('types[0]', 'PORT_VISIT');
    query.set('vesselTypes[0]', input.vesselType);
    anchorages.forEach((id, at) => {
      query.set(`portIds[${String(at)}]`, id);
    });
    query.set('start-date', input.from);
    query.set('end-date', input.to);
    query.set('limit', String(PAGE));
    query.set('offset', String(input.offset));
    const url = `${BASE}/v3/events?${query.toString()}`;

    const request: RegisterRequest = {
      url,
      register: REGISTER,
      showErrorBody: true,
      headers: { accept: 'application/json', authorization: `Bearer ${token}` },
    };
    const answer = await readRegister(webFromReach(reach), request);
    if (answer === null) throw new ToolRefusal(`${REGISTER} holds no events for this read`);
    const { entries, nextOffset, total } = shaped(REGISTER, answerShape, answer.json);

    const body = JSON.stringify({
      licence: LICENCE,
      citation: CITATION,
      limit: LIMIT,
      request: {
        dataset: DATASET,
        anchorageIds: anchorages,
        vesselType: input.vesselType,
        from: input.from,
        to: input.to,
        offset: input.offset,
      },
      response: answer.json,
    });
    // The token is in a header and not in the address; this guards against an echo in the body.
    if (body.includes(token))
      throw new ToolRefusal(`${REGISTER} gave an answer that this tool does not store`);
    const stored = await storeRegister(
      session,
      reach,
      {
        ...request,
        title:
          `Global Fishing Watch ${input.vesselType} port visits at ${anchorages.length} ` +
          `anchorages from ${input.from} to ${input.to}, offset ${String(input.offset)}`,
      },
      { body, json: answer.json },
    );
    return {
      ...stored,
      events: entries.length,
      total: total ?? null,
      nextOffset: nextOffset ?? null,
      licence: LICENCE,
      citation: CITATION,
      limit: LIMIT,
    };
  },
});
