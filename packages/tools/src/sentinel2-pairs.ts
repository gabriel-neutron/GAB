// The Sentinel-2 images before and after a dated strike, each one stored as a document. For each
// strike the tool searches the catalogue of the Copernicus Data Space for the nearest scene before
// and the nearest scene after the strike, in a window of days. A scene counts only when the cloud
// share over the box of the site is under a threshold. The share is read from the scene
// classification layer over the box, and not from the total of the scene. The tool cuts the box in
// true colour and stores the image with the scene, the date, the share and the box. The image is
// shown and the record states no damage from it.

import { z } from 'zod';

import { day } from '@gab/proposal/day';

import { imageSize } from './site-image.ts';
import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';
import { webFromReach } from './web-access.ts';

const TOKEN_URL =
  'https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token';
const API = 'https://sh.dataspace.copernicus.eu/api/v1';
const COLLECTION = 'sentinel-2-l2a';
const CRS = 'http://www.opengis.net/def/crs/EPSG/0/4326';

// Origin of the numbers: decided, not calibrated. The issue asks for a window of 15 days. A share
// of cloud under one fifth keeps a site readable. A box of 5 km holds a refinery or a terminal.
const WINDOW_DAYS = 15;
const MAX_CLOUD = 0.2;
const HALF_WIDTH_METRES = 2500;
const MIN_HALF_WIDTH = 500;
const MAX_HALF_WIDTH = 10_000;
const MAX_STRIKES = 100;
const CATALOGUE_LIMIT = 100;
const METRES_PER_DEGREE = 111_320;
// One pixel of the statistics is about 10 m.
const STATISTICS_STEP_DEGREES = 0.0001;
const DAY_MS = 86_400_000;
const TIMEOUT_MS = 60_000;
const MAX_JSON_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
// The scenes of one pass share their time to the second. A window of one minute holds the pass.
const PASS_MS = 60_000;
// A token lives 10 minutes. The tool asks for a new one a minute before the end.
const TOKEN_MARGIN_MS = 60_000;
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);
// The classes of the scene classification layer that hide the ground: cloud shadow (3), cloud of
// medium probability (8), cloud of high probability (9) and thin cirrus (10).
const CLOUD_CLASSES = [3, 8, 9, 10];

export const SENTINEL2_ATTRIBUTION = (year: number): string =>
  `Contains modified Copernicus Sentinel data ${String(year)}`;

const CLOUD_SCRIPT = `//VERSION=3
function setup() {
  return {
    input: [{ bands: ["SCL", "dataMask"] }],
    output: [{ id: "cloud", bands: 1, sampleType: "UINT8" }, { id: "dataMask", bands: 1 }],
  };
}
function evaluatePixel(sample) {
  const cloud = [${CLOUD_CLASSES.join(', ')}].includes(sample.SCL) ? 1 : 0;
  return { cloud: [cloud], dataMask: [sample.dataMask] };
}`;

const COLOUR_SCRIPT = `//VERSION=3
function setup() {
  return { input: ["B04", "B03", "B02"], output: { bands: 3 } };
}
function evaluatePixel(sample) {
  return [2.5 * sample.B04, 2.5 * sample.B03, 2.5 * sample.B02];
}`;

/** A fault of the service. A fault of the access (a bad client, a limit) ends the whole run; a
 * fault of one request ends one strike. The message holds a status and nothing the service said. */
export class ServiceFault extends ToolRefusal {
  readonly stops: boolean;
  constructor(message: string, stops: boolean) {
    super(message);
    this.stops = stops;
  }
}

export interface Box {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

const six = (value: number): number => Number(value.toFixed(6));

/** The box of a point: a square of twice the half width, in degrees. */
export const boxOf = (latitude: number, longitude: number, halfWidth: number): Box => {
  const high = halfWidth / METRES_PER_DEGREE;
  const wide = high / Math.cos(latitude * (Math.PI / 180));
  return {
    south: six(latitude - high),
    west: six(longitude - wide),
    north: six(latitude + high),
    east: six(longitude + wide),
  };
};

const msOf = (value: string): number => Date.parse(`${value}T00:00:00Z`);
const nextDay = (value: string): string => dayOf(msOf(value) + DAY_MS);
const dayOf = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

interface Scene {
  readonly id: string;
  readonly datetime: string;
  readonly day: string;
}

const featureShape = z.object({
  id: z.string().min(1),
  properties: z.object({ datetime: z.iso.datetime() }),
});
const catalogueShape = z.object({ features: z.array(featureShape) });
const tokenShape = z.object({ access_token: z.string().min(1), expires_in: z.number() });
const statisticsShape = z.object({
  data: z.array(
    z.object({
      interval: z.object({ from: z.string() }),
      outputs: z.object({
        cloud: z.object({
          bands: z.object({ B0: z.object({ stats: z.object({ mean: z.number().nullable() }) }) }),
        }),
      }),
    }),
  ),
});

const box4 = (box: Box): number[] => [box.west, box.south, box.east, box.north];

const bounds = (box: Box) => ({ bbox: box4(box), properties: { crs: CRS } });

/** One image kept for a strike. */
export interface PairImage {
  readonly document: string;
  readonly status: 'known' | 'stored';
  readonly scene: string;
  readonly date: string;
  readonly cloud: number;
  readonly box: Box;
  readonly attribution: string;
}

export interface Tried {
  readonly date: string;
  readonly scene: string;
  /** The share of cloud over the box, or null when the service gave no share for the day. */
  readonly cloud: number | null;
}

export interface Side {
  readonly image: PairImage | null;
  /** The days of the window, and the scenes that were tried with their share. */
  readonly window: { readonly from: string; readonly to: string };
  readonly tried: Tried[];
}

const strikeShape = z.strictObject({
  ref: z.string().trim().min(1).max(200).describe('your name for the strike, returned as is'),
  day: day.describe('the first day of the strike'),
  until: day.optional().describe('the last day of a strike in a night; default the first day'),
  latitude: z.number().min(-85).max(85),
  longitude: z.number().min(-180).max(180),
});
const MAX_NIGHT_DAYS = 7;

const boxShape = z.strictObject({
  south: z.number(),
  west: z.number(),
  north: z.number(),
  east: z.number(),
});
const sideShape = z.strictObject({
  image: z
    .strictObject({
      document: z.string(),
      status: z.enum(['known', 'stored']),
      scene: z.string(),
      date: z.string(),
      cloud: z.number(),
      box: boxShape,
      attribution: z.string(),
    })
    .nullable(),
  window: z.strictObject({ from: z.string(), to: z.string() }),
  tried: z.array(
    z.strictObject({ date: z.string(), scene: z.string(), cloud: z.number().nullable() }),
  ),
});

const strikeResult = z.strictObject({
  ref: z.string(),
  outcome: z.enum(['pair', 'one', 'none', 'error']),
  before: sideShape.nullable(),
  after: sideShape.nullable(),
  /** "no clear image" with the dates that were tried, one sentence for each side that has none. */
  notes: z.array(z.string()),
  error: z.string().nullable(),
});

type StrikeResult = z.infer<typeof strikeResult>;

const percent = (share: number | null): string =>
  share === null ? 'no share' : `${String(Math.round(share * 100))} percent cloud`;

const noteOf = (name: 'before' | 'after', side: Side): string =>
  `no clear image ${name} (window ${side.window.from} to ${side.window.to}): ` +
  (side.tried.length === 0
    ? 'the catalogue holds no scene'
    : `tried ${side.tried.map((one) => `${one.date} (${percent(one.cloud)})`).join(', ')}`);

/** The tool on a web that the surface gives. */
export const sentinel2Pairs = defineTool({
  name: 'sentinel2_pairs',
  description:
    'Stores the Sentinel-2 L2A images before and after dated strikes, as documents. For each ' +
    'strike (a day, and a point of the site) it searches the Copernicus Data Space catalogue ' +
    `for the nearest scene before and the nearest scene after the strike, in a window of ` +
    `${String(WINDOW_DAYS)} days, and keeps a scene only when the share of cloud over the box ` +
    '(read from the scene classification layer) is under the threshold. It cuts the box in ' +
    'true colour and stores each image with its scene ID, its date, its cloud share, its box ' +
    'and the credit "Contains modified Copernicus Sentinel data". It reports the strikes with a ' +
    'pair, with one image and with none, and for a side with no clear image the dates that were ' +
    'tried. The image is shown and states no damage. A scene on the day of the strike counts ' +
    'for neither side. The tool needs a free Copernicus Data Space OAuth client: with no client, ' +
    'it refuses and names the settings. A call with many strikes uses the quota of the client.',
  input: z.strictObject({
    strikes: z.array(strikeShape).min(1).max(MAX_STRIKES),
    halfWidthMetres: z
      .number()
      .min(MIN_HALF_WIDTH)
      .max(MAX_HALF_WIDTH)
      .default(HALF_WIDTH_METRES)
      .describe('half of the side of the box around the point of the site, in metres'),
    maxCloud: z
      .number()
      .gt(0)
      .max(1)
      .default(MAX_CLOUD)
      .describe('a scene counts when its share of cloud over the box is under this share'),
  }),
  output: z.strictObject({
    pair: z.number().int(),
    one: z.number().int(),
    none: z.number().int(),
    error: z.number().int(),
    results: z.array(strikeResult),
  }),
  async run(session, input, reach) {
    const web = webFromReach(reach);
    if (web.cdseClientId === undefined || web.cdseClientSecret === undefined)
      throw new ToolRefusal(
        'sentinel2_pairs needs a Copernicus Data Space client: set CDSE_CLIENT_ID and ' +
          'CDSE_CLIENT_SECRET in the research workspace',
      );
    if (web.post === undefined)
      throw new ToolRefusal('this surface gives no POST to the web, so this tool answers nothing');
    if (reach?.store === undefined)
      throw new ToolRefusal('this surface gives no object store, so it stores no image');
    const store = reach.store;
    const now = reach.now;
    const post = web.post.bind(web);
    const client = { id: web.cdseClientId, secret: web.cdseClientSecret };

    let token: { value: string; until: number } | undefined;
    const bearer = async (): Promise<string> => {
      if (token !== undefined && token.until > now().getTime()) return token.value;
      // The client leaves in the body, and the sentence of a fault holds a status only.
      const answer = await post(TOKEN_URL, {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          accept: 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: client.id,
          client_secret: client.secret,
        }).toString(),
        timeoutMs: TIMEOUT_MS,
        maxBytes: MAX_JSON_BYTES,
      }).catch(() => {
        throw new ServiceFault('Copernicus Data Space gave no answer to the token request', true);
      });
      if (answer.status < 200 || answer.status > 299)
        throw new ServiceFault(
          `Copernicus Data Space refused the token request with status ${String(answer.status)}: ` +
            'check CDSE_CLIENT_ID and CDSE_CLIENT_SECRET',
          true,
        );
      const found = tokenShape.safeParse(parse(answer.bytes));
      if (!found.success)
        throw new ServiceFault(
          'Copernicus Data Space gave a token that this tool does not read',
          true,
        );
      token = {
        value: found.data.access_token,
        until: now().getTime() + found.data.expires_in * 1000 - TOKEN_MARGIN_MS,
      };
      return token.value;
    };

    const call = async (path: string, body: unknown, accept: string) => {
      const answer = await post(`${API}${path}`, {
        headers: {
          'content-type': 'application/json',
          accept,
          authorization: `Bearer ${await bearer()}`,
        },
        body: JSON.stringify(body),
        timeoutMs: TIMEOUT_MS,
        maxBytes: accept === 'image/jpeg' ? MAX_IMAGE_BYTES : MAX_JSON_BYTES,
      }).catch(() => {
        throw new ServiceFault(`Copernicus Data Space gave no answer to ${path}`, false);
      });
      if (answer.status < 200 || answer.status > 299)
        throw new ServiceFault(
          `Copernicus Data Space answered ${String(answer.status)} to ${path}`,
          answer.status === 401 || answer.status === 403 || answer.status === 429,
        );
      return answer.bytes;
    };

    const results: StrikeResult[] = [];
    for (const strike of input.strikes) {
      try {
        results.push(await oneStrike(strike));
      } catch (fault) {
        if (!(fault instanceof ToolRefusal) || (fault instanceof ServiceFault && fault.stops))
          throw fault;
        results.push({
          ref: strike.ref,
          outcome: 'error',
          before: null,
          after: null,
          notes: [],
          error: fault.message,
        });
      }
    }
    const count = (outcome: StrikeResult['outcome']) =>
      results.filter((one) => one.outcome === outcome).length;
    return {
      pair: count('pair'),
      one: count('one'),
      none: count('none'),
      error: count('error'),
      results,
    };

    async function oneStrike(strike: z.output<typeof strikeShape>): Promise<StrikeResult> {
      const first = msOf(strike.day);
      const last = msOf(strike.until ?? strike.day);
      if (last < first) throw new ToolRefusal(`the strike ${strike.ref} ends before it starts`);
      if ((last - first) / DAY_MS > MAX_NIGHT_DAYS)
        throw new ToolRefusal(
          `the strike ${strike.ref} lasts more than ${String(MAX_NIGHT_DAYS)} days`,
        );
      const box = boxOf(strike.latitude, strike.longitude, input.halfWidthMetres);
      const windows = {
        before: { from: dayOf(first - WINDOW_DAYS * DAY_MS), to: dayOf(first - DAY_MS) },
        after: { from: dayOf(last + DAY_MS), to: dayOf(last + WINDOW_DAYS * DAY_MS) },
      };
      const range = { from: windows.before.from, to: windows.after.to };
      const scenes = await scenesOf(box, range);
      const shares = await sharesOf(box, range);

      const sideOf = async (name: 'before' | 'after'): Promise<Side> => {
        const window = windows[name];
        const inside = scenes.filter((one) => window.from <= one.day && one.day <= window.to);
        // The nearest first: the latest before the strike, the earliest after it.
        inside.sort((a, b) =>
          name === 'before' ? b.day.localeCompare(a.day) : a.day.localeCompare(b.day),
        );
        const tried: Tried[] = [];
        for (const scene of inside) {
          const cloud = shares.get(scene.day) ?? null;
          tried.push({ date: scene.day, scene: scene.id, cloud });
          if (cloud !== null && cloud < input.maxCloud)
            return { image: await imageOf(scene, cloud, box), window, tried };
        }
        return { image: null, window, tried };
      };
      const before = await sideOf('before');
      const after = await sideOf('after');
      const have = Number(before.image !== null) + Number(after.image !== null);
      return {
        ref: strike.ref,
        outcome: have === 2 ? 'pair' : have === 1 ? 'one' : 'none',
        before,
        after,
        notes: [
          ...(before.image === null ? [noteOf('before', before)] : []),
          ...(after.image === null ? [noteOf('after', after)] : []),
        ],
        error: null,
      };
    }

    async function scenesOf(box: Box, range: { from: string; to: string }): Promise<Scene[]> {
      const bytes = await call(
        '/catalog/1.0.0/search',
        {
          collections: [COLLECTION],
          datetime: `${range.from}T00:00:00Z/${nextDay(range.to)}T00:00:00Z`,
          bbox: box4(box),
          limit: CATALOGUE_LIMIT,
          fields: { include: ['id', 'properties.datetime'] },
        },
        'application/geo+json',
      );
      const found = catalogueShape.safeParse(parse(bytes));
      // A full page may hide more scenes. The tool does not read the next page, so it says so.
      if (found.success && found.data.features.length >= CATALOGUE_LIMIT)
        throw new ServiceFault('the catalogue holds more scenes than one page', false);
      if (!found.success)
        throw new ServiceFault(
          'Copernicus Data Space gave a catalogue that this tool does not read',
          false,
        );
      return found.data.features.map((one) => ({
        id: one.id,
        datetime: one.properties.datetime,
        day: one.properties.datetime.slice(0, 10),
      }));
    }

    // The share of cloud over the box for each day of the range, from the classification layer.
    async function sharesOf(box: Box, range: { from: string; to: string }) {
      const bytes = await call(
        '/statistics',
        {
          input: { bounds: bounds(box), data: [{ type: COLLECTION, dataFilter: {} }] },
          aggregation: {
            timeRange: { from: `${range.from}T00:00:00Z`, to: `${nextDay(range.to)}T00:00:00Z` },
            aggregationInterval: { of: 'P1D' },
            evalscript: CLOUD_SCRIPT,
            resx: STATISTICS_STEP_DEGREES,
            resy: STATISTICS_STEP_DEGREES,
          },
        },
        'application/json',
      );
      const found = statisticsShape.safeParse(parse(bytes));
      if (!found.success)
        throw new ServiceFault(
          'Copernicus Data Space gave statistics that this tool does not read',
          false,
        );
      const shares = new Map<string, number>();
      for (const one of found.data.data) {
        const mean = one.outputs.cloud.bands.B0.stats.mean;
        if (mean !== null && Number.isFinite(mean))
          shares.set(one.interval.from.slice(0, 10), mean);
      }
      return shares;
    }

    async function imageOf(scene: Scene, cloud: number, box: Box): Promise<PairImage> {
      const at = Date.parse(scene.datetime);
      const size = imageSize(box);
      const bytes = await call(
        '/process',
        {
          input: {
            bounds: bounds(box),
            data: [
              {
                type: COLLECTION,
                dataFilter: {
                  timeRange: {
                    from: new Date(at - PASS_MS).toISOString(),
                    to: new Date(at + PASS_MS).toISOString(),
                  },
                  mosaickingOrder: 'leastCC',
                },
              },
            ],
          },
          output: {
            width: size.width,
            height: size.height,
            responses: [{ identifier: 'default', format: { type: 'image/jpeg' } }],
          },
          evalscript: COLOUR_SCRIPT,
        },
        'image/jpeg',
      );
      if (!Buffer.from(bytes.subarray(0, JPEG.length)).equals(JPEG))
        throw new ServiceFault('Copernicus Data Space gave no JPEG image of the box', false);
      const year = Number(scene.day.slice(0, 4));
      const boxText = box4(box)
        .map((one) => one.toFixed(6))
        .join(',');
      const percentText = String(Math.round(cloud * 1000) / 10);
      const title =
        `Sentinel-2 L2A true colour image of ${scene.day} (scene ${scene.id}, ` +
        `${percentText} percent cloud, box ${boxText})`;
      const stored = await storeAnswer(session, store, {
        kind: 'api',
        bytes,
        mime: 'image/jpeg',
        // Synthetic: it names the scene and the box. It holds no key and no token.
        uri: `${API}/process/${COLLECTION}/${encodeURIComponent(scene.id)}/${boxText}`,
        title,
        pages: [pageOf(scene, cloud, box, size, year)],
        day: now().toISOString().slice(0, 10),
      });
      return {
        document: stored.id,
        status: stored.status,
        scene: scene.id,
        date: scene.day,
        cloud: Math.round(cloud * 1000) / 1000,
        box,
        attribution: SENTINEL2_ATTRIBUTION(year),
      };
    }
  },
});

const parse = (bytes: Uint8Array): unknown => {
  try {
    return JSON.parse(Buffer.from(bytes).toString('utf8')) as unknown;
  } catch {
    return null;
  }
};

// The text of the image: what it shows, the scene, the date, the share of cloud and the credit.
// OCR reads nothing in a satellite image.
const pageOf = (
  scene: Scene,
  cloud: number,
  box: Box,
  size: ReturnType<typeof imageSize>,
  year: number,
): string =>
  [
    `Sentinel-2 L2A true colour image (bands B04, B03, B02) of a site box, acquired on ${scene.day}.`,
    `Scene ${scene.id}, sensing time ${scene.datetime}.`,
    `Cloud share over the box: ${String(Math.round(cloud * 1000) / 10)} percent (scene ` +
      'classification layer: cloud shadow, medium and high probability cloud, thin cirrus).',
    `Box (WGS 84): south ${box.south.toFixed(6)}, west ${box.west.toFixed(6)}, north ` +
      `${box.north.toFixed(6)}, east ${box.east.toFixed(6)}.`,
    `${String(size.width)} by ${String(size.height)} pixels, ${String(size.metres)} m for each pixel.`,
    'The image shows the site on this day. It states no damage and no strike.',
    `${SENTINEL2_ATTRIBUTION(year)}.`,
  ].join('\n');
