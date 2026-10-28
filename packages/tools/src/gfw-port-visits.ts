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

// The vessel types of the GET /v3/events documentation. TANKER is not one of them.
const VESSEL_TYPES = [
  'BUNKER',
  'CARGO',
  'DISCREPANCY',
  'CARRIER',
  'FISHING',
  'GEAR',
  'OTHER',
  'PASSENGER',
  'SEISMIC_VESSEL',
  'SUPPORT',
  'NON_FISHING',
  'RESEARCH',
] as const;

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
  // The IMO numbers that GFW gives. The answer holds no IMO for most vessels: read it with the
  // Vessels API then.
  imos: z.array(z.string()),
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
            .regex(
              /^[a-z0-9-]{2,64}$/u,
              'a port id is lower case letters, digits and dashes, for example rus-primorsk',
            ),
        )
        .min(1)
        .max(100),
      // The values of the Events API v3 documentation, checked before the call.
      vesselType: z.enum(VESSEL_TYPES).default('CARGO'),
      // 2 low, 3 medium, 4 high confidence of a port visit. The default drops the low ones.
      confidences: z
        .array(z.union([z.literal(2), z.literal(3), z.literal(4)]))
        .min(1)
        .max(3)
        .default([3, 4]),
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
    // The query names are lower case with dashes: GFW refuses camel case in a GET query.
    query.set('vessel-types[0]', input.vesselType);
    anchorages.forEach((id, at) => {
      query.set(`port-ids[${String(at)}]`, id);
    });
    const confidences = [...new Set(input.confidences)].sort();
    confidences.forEach((level, at) => {
      query.set(`confidences[${String(at)}]`, String(level));
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
        confidences,
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
    const imos = [
      ...new Set(
        entries.flatMap((entry) => {
          const imo = (entry as { vessel?: { imo?: unknown } } | null)?.vessel?.imo;
          return typeof imo === 'string' && imo !== '' ? [imo] : [];
        }),
      ),
    ].sort();
    return {
      ...stored,
      imos,
      events: entries.length,
      total: total ?? null,
      nextOffset: nextOffset ?? null,
      licence: LICENCE,
      citation: CITATION,
      limit: LIMIT,
    };
  },
});
