import { setTimeout as timer } from 'node:timers/promises';

import { day } from '@gab/proposal/day';
import { z } from 'zod';

import { shaped, storeRegister } from './register-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { clipped, webFromReach } from './web-access.ts';

const BASE = 'https://gateway.api.globalfishingwatch.org';
const REGISTER = 'Global Fishing Watch';
const DATASET = 'public-global-presence:latest';

// The terms of the data. The document holds them, so a reader of the document alone sees them.
const LICENCE = 'CC BY-NC 4.0';
const CITATION = 'Global Fishing Watch';
const LIMIT =
  'AIS only: a vessel that switches off its AIS, or that has no AIS in range, is not in this grid.';

// External constraint: the report route needs a region, and only a POST takes a custom polygon.
// shortcut: no live call confirmed this whole-earth polygon, so change it if the API refuses it.
const WHOLE_EARTH = {
  type: 'Polygon',
  coordinates: [
    [
      [-180, -90],
      [180, -90],
      [180, 90],
      [-180, 90],
      [-180, -90],
    ],
  ],
};

// External constraint: the gateway stops a report after 100 s with a 524, so this limit is longer.
const REPORT_TIMEOUT_MS = 120_000;
const READ_TIMEOUT_MS = 30_000;
const POLLS = 6;
const POLL_PAUSE_MS = 15_000;
// A grid is larger than the answer of a register.
const MAX_BYTES = 32 * 1024 * 1024;
const ERROR_BODY = 500;

const answerShape = z.object({
  entries: z.array(z.record(z.string(), z.unknown())),
  nextOffset: z.number().int().nullish(),
});

const cellShape = z.object({
  lat: z.number(),
  lon: z.number(),
  hours: z.number(),
  vesselIDs: z.number().int().nullish(),
});

const lastReportShape = z.object({
  status: z.union([z.string(), z.number()]).optional(),
});

const parsed = (body: string): unknown => {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new ToolRefusal(`${REGISTER} gave an answer that is not JSON`);
  }
};

export const gfwPresenceGrid = defineTool({
  name: 'gfw_presence_grid',
  description:
    'Reads the AIS presence grid of a list of GFW vessel ids in the Global Fishing Watch 4Wings ' +
    'report between two dates, and stores the answer as one internal document with the licence ' +
    '(CC BY-NC 4.0, non-commercial use) and the limit of the data (AIS only). The output gives ' +
    'the count of cells, the hours and the document id, and never a row. The tool needs the free ' +
    'GFW token: with no token set, it refuses and names the setting. The token goes in a header, ' +
    'and the stored address holds none. GFW runs one report for each user, so a second report ' +
    'gets a refusal: call again later. When a report takes more than 100 s, the tool reads the ' +
    'last report of the user and sets recovered. That answer names no request, so run no other ' +
    'report during the call. The GFW documentation does not list a vessel_id filter for this ' +
    'dataset. When a cell holds more vessels than the list, GFW did not apply the filter: the ' +
    'tool refuses and stores nothing. vesselCountChecked says only that each cell gave a count ' +
    'within the list. It does not prove that GFW applied the filter, and it is false for an ' +
    'empty grid or an answer with no count. The window holds the day from and excludes the day to.',
  input: z
    .strictObject({
      vesselIds: z
        .array(
          z
            .string()
            .trim()
            // This check keeps a quote out of the filter, which is a text expression.
            .regex(/^[A-Za-z0-9-]{8,64}$/u, 'a GFW vessel id is letters, digits and hyphens'),
        )
        .min(1)
        .max(100),
      from: day,
      to: day,
      spatialResolution: z.enum(['LOW', 'HIGH']),
      temporalResolution: z.enum(['ENTIRE', 'MONTHLY']),
    })
    .refine((input) => input.from < input.to, { error: 'from comes before to' }),
  output: z.strictObject({
    document: z.string(),
    status: z.enum(['known', 'stored']),
    cells: z.number().int(),
    hours: z.number(),
    vesselCountChecked: z.boolean(),
    recovered: z.boolean(),
    licence: z.string(),
    citation: z.string(),
    limit: z.string(),
  }),
  async run(session, input, reach) {
    const web = webFromReach(reach);
    const token = web.gfwToken ?? '';
    if (token === '')
      throw new ToolRefusal(
        'gfw_presence_grid needs a token: set GFW_API_TOKEN in the research workspace',
      );
    if (web.post === undefined)
      throw new ToolRefusal('this surface gives no POST to the web, so this tool answers nothing');
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no answer');
    const sleep = reach.sleep ?? ((ms: number) => timer(ms));

    // Sorted, so the same set of vessels in any order is one address.
    const vesselIds = [...new Set(input.vesselIds)].sort();
    const query = new URLSearchParams();
    query.set('datasets[0]', DATASET);
    query.set('format', 'JSON');
    query.set('spatial-aggregation', 'false');
    query.set('spatial-resolution', input.spatialResolution);
    query.set('temporal-resolution', input.temporalResolution);
    query.set('date-range', `${input.from},${input.to}`);
    query.set('filters[0]', `vessel_id in (${vesselIds.map((id) => `'${id}'`).join(', ')})`);
    const url = `${BASE}/v3/4wings/report?${query.toString()}`;
    const headers = { accept: 'application/json', authorization: `Bearer ${token}` };

    const refusalOf = (status: number, body: string): ToolRefusal => {
      const text = clipped(body.trim().split(token).join('[token]'), ERROR_BODY);
      return new ToolRefusal(`${REGISTER} answered ${String(status)}${text && `: ${text}`}`);
    };

    // shortcut: the last report names no request, so it can be the report of another session with
    // this token. Check the request when a live answer shows a field that names it.
    const readLastReport = async (): Promise<unknown> => {
      for (let poll = 0; poll < POLLS; poll += 1) {
        if (poll > 0) await sleep(POLL_PAUSE_MS);
        const got = await web
          .get(`${BASE}/v3/4wings/last-report`, {
            headers,
            timeoutMs: READ_TIMEOUT_MS,
            maxBytes: MAX_BYTES,
          })
          .catch(() => {
            throw new ToolRefusal(`${REGISTER} gave no whole answer to the last-report read`);
          });
        if (got.status === 429) continue;
        if (got.status === 404)
          throw new ToolRefusal(`${REGISTER} holds no last report: call this tool again`);
        if (got.status < 200 || got.status > 299) throw refusalOf(got.status, got.body);
        const json = parsed(got.body);
        const { status } = shaped(REGISTER, lastReportShape, json);
        if (status === 'running') continue;
        // A finished report has no status, so any other status is the end of a failed report.
        if (status !== undefined)
          throw new ToolRefusal(
            `${REGISTER} ended the last report with status ${String(status)}: ` +
              clipped(got.body.split(token).join('[token]'), ERROR_BODY),
          );
        return json;
      }
      throw new ToolRefusal(
        `${REGISTER} gave no finished report: call this tool again in a few minutes`,
      );
    };

    const answered = await web.post
      .call(web, url, {
        headers: { ...headers, 'content-type': 'application/json' },
        body: JSON.stringify({ geojson: WHOLE_EARTH }),
        timeoutMs: REPORT_TIMEOUT_MS,
        maxBytes: MAX_BYTES,
      })
      .catch((fault: unknown) => {
        if (fault instanceof Error && fault.name === 'TimeoutError') return null;
        throw new ToolRefusal(
          `${REGISTER} gave no whole answer: the cause can be a grid larger than the cap, so try ` +
            'LOW, ENTIRE or a shorter window',
        );
      });
    if (answered?.status === 429)
      throw new ToolRefusal(
        `${REGISTER} runs one report for each user, and one runs now: call this tool again later`,
      );
    const recovered = answered === null || answered.status === 524;
    let json: unknown;
    if (recovered) json = await readLastReport();
    else {
      const body = new TextDecoder().decode(answered.bytes);
      if (answered.status < 200 || answered.status > 299) throw refusalOf(answered.status, body);
      json = parsed(body);
    }

    const { entries, nextOffset } = shaped(REGISTER, answerShape, json);
    if (typeof nextOffset === 'number')
      throw new ToolRefusal(`${REGISTER} gave a part of the grid, and this tool reads no pages`);
    // The documentation shows rows in the entries, and other 4Wings answers nest them by dataset.
    const rows = entries.flatMap((entry): unknown[] => {
      const lists = Object.values(entry).filter((value): value is unknown[] =>
        Array.isArray(value),
      );
      return lists.length > 0 ? lists.flat() : [entry];
    });
    const cells = shaped(REGISTER, z.array(cellShape), rows);
    const crowded = cells.find((cell) => (cell.vesselIDs ?? 0) > vesselIds.length);
    if (crowded !== undefined)
      throw new ToolRefusal(
        `${REGISTER} did not apply the vessel filter: a cell holds ${String(crowded.vesselIDs)} ` +
          `vessels, and the list has ${String(vesselIds.length)}. This tool stored nothing`,
      );

    const body = JSON.stringify({
      licence: LICENCE,
      citation: CITATION,
      limit: LIMIT,
      request: {
        dataset: DATASET,
        vesselIds,
        from: input.from,
        to: input.to,
        spatialResolution: input.spatialResolution,
        temporalResolution: input.temporalResolution,
        region: 'whole earth',
        recovered,
      },
      response: json,
    });
    // The token is in a header and not in the address; this guards against an echo in the body.
    if (body.includes(token))
      throw new ToolRefusal(`${REGISTER} gave an answer that this tool does not store`);
    const stored = await storeRegister(
      session,
      reach,
      {
        url,
        register: REGISTER,
        title:
          `Global Fishing Watch presence grid of ${String(vesselIds.length)} vessels, first id ` +
          `${vesselIds[0] ?? ''}, from ${input.from} to ${input.to}, ` +
          `${input.spatialResolution} ${input.temporalResolution}` +
          (recovered ? ', read from the last report, so the request is not confirmed' : ''),
      },
      { body, json },
    );
    return {
      ...stored,
      cells: new Set(cells.map((cell) => `${String(cell.lat)},${String(cell.lon)}`)).size,
      hours: Math.round(cells.reduce((sum, cell) => sum + cell.hours, 0) * 100) / 100,
      vesselCountChecked:
        cells.length > 0 && cells.every((cell) => typeof cell.vesselIDs === 'number'),
      recovered,
      licence: LICENCE,
      citation: CITATION,
      limit: LIMIT,
    };
  },
});
