import { day } from '@gab/proposal/day';
import { z } from 'zod';

import { readRegister, shaped, storeRegister, type RegisterRequest } from './register-answer.ts';
import { defineTool, type Reach, type Session, ToolRefusal } from './tool.ts';
import { webFromReach } from './web-access.ts';

// An MMSI is typed by the crew, reused after a sale and spoofed by a dark fleet, so a match by the
// MMSI alone never names a hull.
export const MMSI_LEAD_SENTENCE =
  'These events were matched by the MMSI alone, so they are a lead: an MMSI is reused and ' +
  'spoofed, and no claim joins them to a hull without the IMO number or the GFW vessel id.';

const BASE = 'https://gateway.api.globalfishingwatch.org';

// External constraint: the event datasets of the Global Fishing Watch API, version 3, and the
// dataset of vessel identities that its search reads.
const DATASETS = {
  encounter: 'public-global-encounters-events:latest',
  loitering: 'public-global-loitering-events:latest',
  gap: 'public-global-gaps-events:latest',
  port_visit: 'public-global-port-visits-events:latest',
} as const;
const IDENTITY_DATASET = 'public-global-vessel-identity:latest';
const TYPES = ['encounter', 'loitering', 'gap', 'port_visit'] as const;

// The largest page that one stored answer holds. A longer history is read with the offset.
const PAGE = 200;

const searchAnswer = z.object({
  entries: z
    .array(
      z.object({
        selfReportedInfo: z
          .array(z.object({ id: z.string(), ssvid: z.string().nullish() }))
          .default([]),
        registryInfo: z.array(z.object({ imo: z.string().nullish() })).default([]),
      }),
    )
    .default([]),
});

const anchorageShape = z.object({
  id: z.string().nullish(),
  name: z.string().nullish(),
  flag: z.string().nullish(),
  atDock: z.boolean().nullish(),
  lat: z.number().nullish(),
  lon: z.number().nullish(),
});

const eventsAnswer = z.object({
  entries: z
    .array(
      z.object({
        id: z.string(),
        type: z.string(),
        start: z.string().nullish(),
        end: z.string().nullish(),
        position: z.object({ lat: z.number().nullish(), lon: z.number().nullish() }).nullish(),
        port_visit: z.object({ startAnchorage: anchorageShape.nullish() }).nullish(),
      }),
    )
    .default([]),
  nextOffset: z.number().int().nullish(),
});

const outputShape = z.strictObject({
  document: z.string(),
  status: z.enum(['known', 'stored']),
  matchedBy: z.enum(['vesselId', 'mmsi', 'imo']),
  vesselIds: z.array(z.string()),
  lead: z.literal(MMSI_LEAD_SENTENCE).nullable(),
  nextOffset: z.number().int().nullable(),
  events: z.array(
    z.strictObject({
      id: z.string(),
      type: z.string(),
      start: z.string().nullable(),
      end: z.string().nullable(),
      lat: z.number().nullable(),
      lon: z.number().nullable(),
      // The anchorage of a port visit may be the port near a terminal, and not the terminal.
      anchorage: z
        .strictObject({
          id: z.string().nullable(),
          name: z.string().nullable(),
          flag: z.string().nullable(),
          atDock: z.boolean().nullable(),
          lat: z.number().nullable(),
          lon: z.number().nullable(),
        })
        .nullable(),
    }),
  ),
});

const requestOf = (token: string, url: string): RegisterRequest => ({
  url,
  register: 'Global Fishing Watch',
  headers: { accept: 'application/json', authorization: `Bearer ${token}` },
});

// A list of identities is a lead and is not stored. More than one identity for one MMSI or one
// IMO number is the case that the number cannot settle, so the tool names them and joins none. An
// IMO number counts only in the registry info: the crew types the self-reported one.
const vesselIdsOf = async (
  reach: Reach,
  token: string,
  by: { mmsi: string } | { imo: string },
): Promise<string[]> => {
  const [kind, number] = 'mmsi' in by ? (['MMSI', by.mmsi] as const) : (['IMO', by.imo] as const);
  const query = new URLSearchParams({ query: number, 'datasets[0]': IDENTITY_DATASET });
  const answer = await readRegister(
    webFromReach(reach),
    requestOf(token, `${BASE}/v3/vessels/search?${query.toString()}`),
  );
  const identities = (
    answer === null ? [] : shaped('Global Fishing Watch', searchAnswer, answer.json).entries
  )
    .filter((entry) =>
      'imo' in by ? entry.registryInfo.some((info) => info.imo?.trim() === by.imo) : true,
    )
    .map((entry) =>
      'mmsi' in by
        ? entry.selfReportedInfo.filter((info) => info.ssvid === by.mmsi).map((info) => info.id)
        : entry.selfReportedInfo.map((info) => info.id),
    )
    .filter((ids) => ids.length > 0);
  const [only, ...others] = identities;
  if (only === undefined)
    throw new ToolRefusal(`Global Fishing Watch knows no vessel with the ${kind} ${number}`);
  if (others.length > 0)
    throw new ToolRefusal(
      `the ${kind} ${number} names ${identities.length} vessel identities in Global Fishing Watch ` +
        `(${identities.map((ids) => ids.join(' + ')).join(', ')}): give one of them as vesselId`,
    );
  return [...new Set(only)];
};

const eventsOf = async (
  session: Session,
  reach: Reach,
  token: string,
  vessels: readonly string[],
  input: { from: string; to: string; types: readonly (typeof TYPES)[number][]; offset: number },
) => {
  const query = new URLSearchParams();
  input.types.forEach((type, at) => {
    query.set(`datasets[${String(at)}]`, DATASETS[type]);
  });
  vessels.forEach((vessel, at) => {
    query.set(`vessels[${String(at)}]`, vessel);
  });
  query.set('start-date', input.from);
  query.set('end-date', input.to);
  query.set('limit', String(PAGE));
  query.set('offset', String(input.offset));
  const request = requestOf(token, `${BASE}/v3/events?${query.toString()}`);
  const answer = await readRegister(webFromReach(reach), request);
  if (answer === null) throw new ToolRefusal('Global Fishing Watch holds no events for this read');
  const stored = await storeRegister(
    session,
    reach,
    {
      ...request,
      title:
        `Global Fishing Watch ${input.types.join(', ')} events of ${vessels.join(', ')} ` +
        `from ${input.from} to ${input.to}`,
    },
    answer,
  );
  return { answer, ...stored };
};

export const vesselEvents = defineTool({
  name: 'vessel_events',
  description:
    'Reads the encounter, loitering, AIS gap and port visit events of one vessel in Global ' +
    'Fishing Watch, ' +
    'by its GFW vessel id, by its IMO number (checked in the GFW registry info) or by its MMSI, ' +
    'between two dates. The API is free but needs a ' +
    'token: with no token set, the tool refuses and names the setting. The answer is stored ' +
    'once as an api document; read the next page with nextOffset. A match by the MMSI alone is ' +
    'a lead, and the output says so. A port visit gives its anchorage, which may be the port ' +
    'near a terminal and not the terminal.',
  input: z
    .strictObject({
      vesselId: z
        .string()
        .trim()
        .regex(/^[A-Za-z0-9-]{8,64}$/u, 'a GFW vessel id is letters, digits and hyphens')
        .optional(),
      mmsi: z
        .string()
        .trim()
        .regex(/^\d{9}$/u, 'an MMSI is nine digits')
        .optional(),
      imo: z
        .string()
        .trim()
        .regex(/^\d{7}$/u, 'an IMO number is seven digits')
        .optional(),
      from: day,
      to: day,
      types: z
        .array(z.enum(TYPES))
        .min(1)
        .default([...TYPES]),
      offset: z.number().int().min(0).default(0),
    })
    .refine(
      (input) =>
        [input.vesselId, input.mmsi, input.imo].filter((given) => given !== undefined).length === 1,
      { error: 'give one of vesselId, mmsi or imo, and not more' },
    )
    .refine((input) => input.from <= input.to, { error: 'from comes before to' }),
  output: outputShape,
  async run(session, input, reach) {
    const token = webFromReach(reach).gfwToken ?? '';
    if (token === '')
      throw new ToolRefusal(
        'vessel_events needs a token: set GFW_API_TOKEN in the research workspace',
      );
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no answer');
    const matchedBy: 'mmsi' | 'imo' | 'vesselId' =
      input.vesselId !== undefined ? 'vesselId' : input.imo !== undefined ? 'imo' : 'mmsi';
    const vessels =
      input.vesselId !== undefined
        ? [input.vesselId]
        : await vesselIdsOf(
            reach,
            token,
            input.imo !== undefined ? { imo: input.imo } : { mmsi: input.mmsi ?? '' },
          );
    const read = await eventsOf(session, reach, token, vessels, {
      ...input,
      types: TYPES.filter((type) => input.types.includes(type)),
    });
    const { entries, nextOffset } = shaped('Global Fishing Watch', eventsAnswer, read.answer.json);
    return {
      document: read.document,
      status: read.status,
      matchedBy,
      vesselIds: vessels,
      lead: matchedBy === 'mmsi' ? MMSI_LEAD_SENTENCE : null,
      nextOffset: nextOffset ?? null,
      events: entries.map((event) => ({
        id: event.id,
        type: event.type,
        start: event.start ?? null,
        end: event.end ?? null,
        lat: event.position?.lat ?? null,
        lon: event.position?.lon ?? null,
        anchorage:
          event.port_visit?.startAnchorage === undefined || event.port_visit.startAnchorage === null
            ? null
            : {
                id: event.port_visit.startAnchorage.id ?? null,
                name: event.port_visit.startAnchorage.name ?? null,
                flag: event.port_visit.startAnchorage.flag ?? null,
                atDock: event.port_visit.startAnchorage.atDock ?? null,
                lat: event.port_visit.startAnchorage.lat ?? null,
                lon: event.port_visit.startAnchorage.lon ?? null,
              },
      })),
    };
  },
});
