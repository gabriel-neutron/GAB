import type { MiddlewareHandler } from 'hono';

const JSON_MEDIA = 'application/json';
const OWN_SITE = 'same-origin';

const WRONG_MEDIA = 'the body must be sent as application/json';
const OTHER_SITE = 'the request does not come from this site';

const UNSUPPORTED_MEDIA_TYPE = 415;
const FORBIDDEN = 403;

interface Turned {
  readonly status: typeof UNSUPPORTED_MEDIA_TYPE | typeof FORBIDDEN;
  readonly refusal: string;
}

// External constraint: the writer listens on 127.0.0.1:5177, and the proxy of the development
// server keeps the Host of the browser page, which is on port 5173. No other name is this writer.
const OWN_HOSTS: ReadonlySet<string> = new Set([
  '127.0.0.1:5177',
  'localhost:5177',
  '127.0.0.1:5173',
  'localhost:5173',
]);
const OWN_ORIGINS: ReadonlySet<string> = new Set([...OWN_HOSTS].map((host) => `http://${host}`));

const mediaOf = (header: string | null): string => (header ?? '').split(';')[0]?.trim() ?? '';

const fromOtherSite = (headers: Headers): boolean => {
  const host = headers.get('host');
  const origin = headers.get('origin');
  const site = headers.get('sec-fetch-site');
  if (host === null || !OWN_HOSTS.has(host.toLowerCase())) return true;
  if (origin !== null && !OWN_ORIGINS.has(origin.toLowerCase())) return true;
  return site !== null && site !== OWN_SITE;
};

// External constraint: a page whose name points at the loopback address is same-origin to the
// browser, and only its Host shows it. A media type other than JSON makes a browser ask before it
// sends. A caller that is not a browser, such as the tooling of the operator, sends no site header.
const turnedAway = (headers: Headers): Turned | undefined => {
  if (fromOtherSite(headers)) return { status: FORBIDDEN, refusal: OTHER_SITE };
  if (mediaOf(headers.get('content-type')).toLowerCase() !== JSON_MEDIA)
    return { status: UNSUPPORTED_MEDIA_TYPE, refusal: WRONG_MEDIA };
  return undefined;
};

export const admitOwnSiteJson = (): MiddlewareHandler => async (context, next) => {
  const held = turnedAway(context.req.raw.headers);
  if (held !== undefined) return context.json({ refusal: held.refusal }, held.status);
  await next();
  return undefined;
};
