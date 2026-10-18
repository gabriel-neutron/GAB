// The satellite image of the box of a site, stored as a document. A reviewer compares a point
// with it, and a person can place a point on a feature that it shows. The image comes from the
// Sentinel-2 cloudless layer of 2016 by EOX, the one layer of that service under a licence of
// plain attribution: the layers from 2018 are CC BY-NC-SA. The image needs no key. A geocoder
// answer and the imagery of Esri are no stored source (panel verdict on the map sources).

import { z } from 'zod';

import { FetchRefusal, guardedGet } from './fetch-guard.ts';
import { storeAnswer } from './store-answer.ts';
import { defineTool, ToolRefusal } from './tool.ts';

/** The WMS of EOX. A test gives the address of a local server. */
export const EOX_WMS = 'https://tiles.maps.eox.at/wms';

// External constraint: the name of the 2016 layer in the capabilities of the service, and the
// credit that the service gives with it. The licence asks for the credit whole.
const LAYER = 's2cloudless';
export const SITE_IMAGE_CREDIT =
  'EOxCloudless https://cloudless.eox.at by EOX IT Services GmbH (Contains modified ' +
  'Copernicus Sentinel data 2016), licence CC BY 4.0 ' +
  '(https://creativecommons.org/licenses/by/4.0/)';

// A pixel of Sentinel-2 is 10 m. Origin of the limits: decided, not calibrated. The largest
// refinery or port of the record is less than 20 km wide, and an image of 2048 pixels holds it
// at 10 m for each pixel. A box smaller than 200 m shows a few pixels and no site.
const METRES_PER_PIXEL = 10;
const MAX_PIXELS = 2048;
const MIN_PIXELS = 64;
// The image keeps the shape of the box, so a long side holds at most this many short sides.
const MAX_SHAPE = MAX_PIXELS / MIN_PIXELS;
const MAX_SPAN_DEGREES = 0.25;
const MIN_SPAN_DEGREES = 0.002;
const METRES_PER_DEGREE = 111_320;
const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const TIMEOUT_MS = 30_000;
const MAX_TITLE = 500;
const JPEG = Buffer.from([0xff, 0xd8, 0xff]);

const latitude = z.number().min(-85).max(85);
const longitude = z.number().min(-180).max(180);

// Six decimals are about 10 cm, so the same box gives the same address and the same bytes.
const fixed = (degrees: number): string => degrees.toFixed(6);

// The width and the height of the box on the ground, in metres.
const groundOf = (box: Box): { wide: number; high: number } => {
  const middle = ((box.south + box.north) / 2) * (Math.PI / 180);
  return {
    wide: (box.east - box.west) * METRES_PER_DEGREE * Math.cos(middle),
    high: (box.north - box.south) * METRES_PER_DEGREE,
  };
};

/** The size of the image in pixels, and the metres of one pixel: about 10 m, at most 2048 and
 * at least 64 pixels on a side. The image keeps the shape of the box. */
export const imageSize = (box: Box): { width: number; height: number; metres: number } => {
  const { wide, high } = groundOf(box);
  const native = Math.max(wide, high) / METRES_PER_PIXEL;
  const short = Math.min(wide, high) / METRES_PER_PIXEL;
  let scale = Math.min(1, MAX_PIXELS / native);
  if (short * scale < MIN_PIXELS) scale = MIN_PIXELS / short;
  return {
    width: Math.round((wide / METRES_PER_PIXEL) * scale),
    height: Math.round((high / METRES_PER_PIXEL) * scale),
    metres: Math.round((METRES_PER_PIXEL / scale) * 10) / 10,
  };
};

interface Box {
  readonly south: number;
  readonly west: number;
  readonly north: number;
  readonly east: number;
}

/** The address of the image of a box. */
export const imageAddress = (wms: string, box: Box): string => {
  const { width, height } = imageSize(box);
  const query = new URLSearchParams({
    service: 'WMS',
    request: 'GetMap',
    version: '1.1.1',
    layers: LAYER,
    styles: '',
    srs: 'EPSG:4326',
    bbox: [box.west, box.south, box.east, box.north].map(fixed).join(','),
    width: String(width),
    height: String(height),
    format: 'image/jpeg',
  });
  return `${wms}?${query.toString()}`;
};

// The text of the image: what it shows, its date and its credit. A reader cites a point placed on
// the image with this document, and OCR reads nothing in a satellite image.
const pageOf = (site: string, box: Box, size: ReturnType<typeof imageSize>): string =>
  [
    `Sentinel-2 cloudless 2016 image (EOX, layer ${LAYER}) of the site: ${site}.`,
    `Box (WGS 84): south ${fixed(box.south)}, west ${fixed(box.west)}, north ` +
      `${fixed(box.north)}, east ${fixed(box.east)}.`,
    `${String(size.width)} by ${String(size.height)} pixels, ${String(size.metres)} m for each ` +
      `pixel (the data has ${String(METRES_PER_PIXEL)} m).`,
    'The image shows the site as it was in 2016. A site that was built later is not on it, and ' +
      'a gate or a small berth is not visible at this size. A point placed on the image must ' +
      'show a feature that is visible on it.',
    SITE_IMAGE_CREDIT,
  ].join('\n');

const boxShape = z
  .strictObject({
    south: latitude.describe('the south edge, in decimal degrees'),
    west: longitude.describe('the west edge, in decimal degrees'),
    north: latitude.describe('the north edge, in decimal degrees'),
    east: longitude.describe('the east edge, in decimal degrees'),
    site: z.string().trim().min(1).max(200).describe('the name of the site, for the title'),
  })
  .superRefine((box, context) => {
    const fault = (message: string) => context.addIssue({ code: 'custom', message });
    if (box.north <= box.south) fault('north is larger than south');
    if (box.east <= box.west)
      fault('east is larger than west (a box across 180 degrees is no box)');
    if (box.north - box.south > MAX_SPAN_DEGREES || box.east - box.west > MAX_SPAN_DEGREES)
      fault(`a side of the box is at most ${String(MAX_SPAN_DEGREES)} degrees`);
    if (box.north - box.south < MIN_SPAN_DEGREES || box.east - box.west < MIN_SPAN_DEGREES)
      fault(`a side of the box is at least ${String(MIN_SPAN_DEGREES)} degrees`);
    const { wide, high } = groundOf(box);
    if (Math.max(wide, high) > MAX_SHAPE * Math.min(wide, high))
      fault(`the long side of the box is at most ${String(MAX_SHAPE)} times its short side`);
  });

/** The tool on one WMS address. A test gives the address of a local server. */
export const siteImageAt = (wms: string) =>
  defineTool({
    name: 'site_image',
    description:
      'Stores the satellite image of the box of a site (a plant, a port, a terminal) as a ' +
      'document: the Sentinel-2 cloudless 2016 layer of EOX, about 10 m for each pixel, under ' +
      'CC BY 4.0. Give the south, west, north and east edges in decimal degrees (a side of ' +
      `${String(MIN_SPAN_DEGREES)} to ${String(MAX_SPAN_DEGREES)} degrees) and the name of the ` +
      'site. The text of the document states the box, the date of the image and its credit. ' +
      'Use it for a reviewer to compare a point with the site, and as the source of a point ' +
      'that a person places on a feature that the image shows. The image is of 2016: a site ' +
      'built later is not on it. The same box gives the same document.',
    input: boxShape,
    output: z.strictObject({
      document: z.string(),
      status: z.enum(['known', 'stored']),
      title: z.string(),
      url: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      credit: z.string(),
      notice: z.string().nullable(),
    }),
    async run(session, input, reach) {
      if (reach?.store === undefined)
        throw new ToolRefusal('this surface gives no object store, so it stores no image');
      const url = imageAddress(wms, input);
      const size = imageSize(input);
      let got;
      try {
        got = await guardedGet(url, {
          maxBytes: MAX_IMAGE_BYTES,
          timeoutMs: reach.fetchTimeoutMs ?? TIMEOUT_MS,
          maxRedirects: 0,
          ask: { accept: 'image/jpeg' },
          ...(reach.lookup === undefined ? {} : { lookup: reach.lookup }),
          ...(reach.refuses === undefined ? {} : { refuses: reach.refuses }),
        });
      } catch (fault) {
        if (fault instanceof FetchRefusal)
          throw new ToolRefusal(`EOX gave no image of the box: ${fault.message}`);
        throw fault;
      }
      // An error of a WMS comes as XML with a success status.
      if (!Buffer.from(got.bytes.subarray(0, JPEG.length)).equals(JPEG))
        throw new ToolRefusal(
          `EOX gave no JPEG image of the box (type ${got.contentType ?? 'none'}), so nothing is ` +
            'stored',
        );

      const title = (
        `Sentinel-2 cloudless 2016 image of ${input.site} (box ` +
        `${[input.south, input.west, input.north, input.east].map(fixed).join(', ')})`
      ).slice(0, MAX_TITLE);
      const stored = await storeAnswer(session, reach.store, {
        kind: 'api',
        bytes: got.bytes,
        mime: 'image/jpeg',
        uri: url,
        title,
        pages: [pageOf(input.site, input, size)],
        day: reach.now().toISOString().slice(0, 10),
        provider: 'eox_s2cloudless_2016',
      });
      return {
        document: stored.id,
        status: stored.status,
        title: stored.title,
        url,
        width: size.width,
        height: size.height,
        credit: SITE_IMAGE_CREDIT,
        // The same bytes are one document. A uniform image (water, snow) of another box or site
        // gives the document of the first one, and its text states that box.
        notice:
          stored.title === title
            ? null
            : `these bytes are already document ${stored.id} (${stored.title}), and its text ` +
              'states its own box: the image shows no feature of this box',
      };
    },
  });

export const siteImage = siteImageAt(EOX_WMS);
