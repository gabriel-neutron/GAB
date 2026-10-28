import { setTimeout as timer } from 'node:timers/promises';

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

// The Vessels API reads many ids in one GET. The batch is small, so the address stays short, and
// the calls run one after the other with a pause, as the API limits the rate of a token.
const IDENTITY_DATASET = 'public-global-vessel-identity:latest';
const VESSEL_BATCH = 20;
const VESSEL_PAUSE_MS = 1_000;

// shortcut: the GFW documentation lists no tanker value for the registry ship type (the vessel types
// of the reference data have no tanker), so a vessel is a tanker when a registry class or ship type
// holds the word. Name the exact values here when a live answer shows them.
const TANKER = /tanker/iu;
// A bunker boat, a gas carrier and a chemical tanker are not in the oil export fleet.
const NOT_OIL = /bunker|lng|lpg|gas|chemical/iu;
const isOilTanker = (type: string): boolean => TANKER.test(type) && !NOT_OIL.test(type);
// The wait before the one retry of a 429.
const RETRY_WAIT_MS = 5_000;

const answerShape = z.object({
  entries: z.array(z.unknown()).default([]),
  nextOffset: z.number().int().nullish(),
  total: z.number().int().nullish(),
});

const visitVessel = z
  .object({
    vessel: z.object({
      id: z.string().optional(),
      name: z.string().nullish(),
      ssvid: z.string().nullish(),
      flag: z.string().nullish(),
      imo: z.string().nullish(),
    }),
  })
  .transform((e) => e.vessel);

// What the Vessels API gives for one identity. selfReportedInfo is a list in most answers and one
// object in the example of the documentation: both are read.
const text = z.string().nullish();
const identityShape = z.object({
  selfReportedInfo: z
    .union([z.array(z.object({ id: text })), z.object({ id: text })])
    .nullish()
    .transform((info) => (info === null || info === undefined ? [] : [info].flat())),
  registryInfo: z
    .array(z.object({ id: text, imo: text, shiptype: text, vesselType: text }))
    .nullish()
    .transform((info) => info ?? []),
  combinedSourcesInfo: z
    .array(
      z.object({
        registryVesselClass: z
          .array(z.object({ value: text }))
          .nullish()
          .transform((v) => v ?? []),
        shiptypes: z
          .array(z.object({ name: text }))
          .nullish()
          .transform((v) => v ?? []),
      }),
    )
    .nullish()
    .transform((info) => info ?? []),
});
const vesselsAnswer = z.object({ entries: z.array(z.unknown()).default([]) });

const registryOf = (entry: z.output<typeof identityShape>) => {
  const imos = entry.registryInfo.flatMap((r) => (r.imo?.trim() ? [r.imo.trim()] : []));
  const types = [
    ...entry.registryInfo.flatMap((r) => [r.shiptype, r.vesselType]),
    ...entry.combinedSourcesInfo.flatMap((c) => [
      ...c.registryVesselClass.map((v) => v.value),
      ...c.shiptypes.map((t) => t.name),
    ]),
  ].filter((t): t is string => typeof t === 'string' && t !== '');
  return {
    imo: imos[0] ?? null,
    shipTypes: [...new Set(types)].sort(),
    inRegistry: entry.registryInfo.length > 0,
  };
};

const vesselShape = z.strictObject({
  vesselId: z.string(),
  name: z.string().nullable(),
  mmsi: z.string().nullable(),
  flag: z.string().nullable(),
  imo: z.string().nullable(),
  // Every ship type or class that the registry gives. Empty when the registry holds no record.
  shipTypes: z.array(z.string()),
  tanker: z.boolean(),
  inRegistry: z.boolean(),
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
  // The vessels of the page with their registry identity: IMO and ship type.
  vessels: z.array(vesselShape),
  // The documents of the Vessels API answers, one for each batch of ids.
  vesselDocuments: z.array(z.string()),
  // The vessels that the registry does not know: they have no IMO, and tankersOnly drops them.
  withoutRegistry: z.number().int(),
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
    'page of 200 events: read the next page with nextOffset until it is null. Then it reads each ' +
    'distinct GFW vessel id of the page in the GFW Vessels API (20 ids for each call, one call each ' +
    'second) and stores each answer as a document: the output gives the registry IMO and ship ' +
    'types. The port visit answer has no tanker class (oil tankers fall in CARGO), so tankersOnly ' +
    'keeps the vessels with a tanker in the registry ship type; a vessel with no registry record ' +
    'is dropped then and counted in withoutRegistry. The window holds ' +
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
      vesselType: z.enum(VESSEL_TYPES),
      // 2 low, 3 medium, 4 high confidence of a port visit. The default drops the low ones.
      confidences: z
        .array(z.union([z.literal(2), z.literal(3), z.literal(4)]))
        .min(1)
        .max(3)
        .default([3, 4]),
      from: day,
      to: day,
      offset: z.number().int().min(0).default(0),
      // Keeps only the vessels whose registry ship type is a tanker. The port visit answer has no
      // tanker class: oil tankers fall in CARGO.
      tankersOnly: z.boolean().default(false),
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
    // The registry step: the identity of each distinct GFW vessel id of the page.
    const seen = new Map<string, z.output<typeof visitVessel>>();
    for (const entry of entries) {
      const vessel = visitVessel.safeParse(entry);
      if (vessel.success && vessel.data.id !== undefined && vessel.data.id !== '')
        seen.set(vessel.data.id, vessel.data);
    }
    const ids = [...seen.keys()].sort();
    const sleep = reach.sleep ?? ((ms: number) => timer(ms));
    const registry = new Map<string, ReturnType<typeof registryOf>>();
    const vesselDocuments: string[] = [];
    for (let at = 0; at < ids.length; at += VESSEL_BATCH) {
      if (at > 0) await sleep(VESSEL_PAUSE_MS);
      const batch = ids.slice(at, at + VESSEL_BATCH);
      const vesselQuery = new URLSearchParams();
      vesselQuery.set('datasets[0]', IDENTITY_DATASET);
      batch.forEach((id, n) => {
        vesselQuery.set(`ids[${String(n)}]`, id);
      });
      vesselQuery.set('registries-info-data', 'ALL');
      const vesselRequest: RegisterRequest = {
        ...request,
        url: `${BASE}/v3/vessels?${vesselQuery.toString()}`,
      };
      let read: Awaited<ReturnType<typeof readRegister>>;
      try {
        read = await readRegister(webFromReach(reach), vesselRequest);
      } catch (fault) {
        if (!(fault instanceof ToolRefusal) || !fault.message.includes('answered 429')) throw fault;
        await sleep(RETRY_WAIT_MS);
        read = await readRegister(webFromReach(reach), vesselRequest);
      }
      if (read === null)
        throw new ToolRefusal(
          `${REGISTER} holds no Vessels answer for ${String(batch.length)} ids: the dataset may have moved`,
        );
      const vesselBody = JSON.stringify({
        licence: LICENCE,
        citation: CITATION,
        limit: LIMIT,
        request: { dataset: IDENTITY_DATASET, vesselIds: batch },
        response: read.json,
      });
      if (vesselBody.includes(token))
        throw new ToolRefusal(`${REGISTER} gave an answer that this tool does not store`);
      const vesselStored = await storeRegister(
        session,
        reach,
        {
          ...vesselRequest,
          title: `Global Fishing Watch identity of ${String(batch.length)} vessels, first id ${batch[0] ?? ''}`,
        },
        { body: vesselBody, json: read.json },
      );
      vesselDocuments.push(vesselStored.document);
      for (const raw of shaped(REGISTER, vesselsAnswer, read.json).entries) {
        const identity = identityShape.safeParse(raw);
        if (!identity.success) continue;
        const found = registryOf(identity.data);
        for (const { id } of identity.data.selfReportedInfo)
          if (id && seen.has(id)) registry.set(id, found);
      }
    }
    const vessels = ids.map((vesselId) => {
      const vessel = seen.get(vesselId);
      const found = registry.get(vesselId);
      return {
        vesselId,
        name: vessel?.name ?? null,
        mmsi: vessel?.ssvid ?? null,
        flag: vessel?.flag ?? null,
        imo: found?.imo ?? vessel?.imo ?? null,
        shipTypes: found?.shipTypes ?? [],
        tanker: found?.shipTypes.some((t) => isOilTanker(t)) ?? false,
        inRegistry: found?.inRegistry ?? false,
      };
    });
    const kept = input.tankersOnly ? vessels.filter((v) => v.tanker) : vessels;
    const keptIds = new Set(kept.map((v) => v.vesselId));
    const events = input.tankersOnly
      ? entries.filter((entry) => {
          const vessel = visitVessel.safeParse(entry);
          return vessel.success && keptIds.has(vessel.data.id ?? '');
        }).length
      : entries.length;
    return {
      ...stored,
      imos: [...new Set(kept.flatMap((v) => (v.imo === null ? [] : [v.imo])))].sort(),
      vessels: kept,
      vesselDocuments,
      withoutRegistry: vessels.filter((v) => !v.inRegistry).length,
      events,
      total: total ?? null,
      nextOffset: nextOffset ?? null,
      licence: LICENCE,
      citation: CITATION,
      limit: LIMIT,
    };
  },
});
