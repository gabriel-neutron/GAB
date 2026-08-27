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

const mediaOf = (header: string | null): string => (header ?? '').split(';')[0]?.trim() ?? '';

// A media type other than JSON makes a browser ask permission before it sends, and the writer
// grants none. An absent site header is allowed, because a caller that is not a browser, such
// as the tooling of the operator, sends none.
const turnedAway = (headers: Headers): Turned | undefined => {
  const site = headers.get('sec-fetch-site');
  if (site !== null && site !== OWN_SITE) return { status: FORBIDDEN, refusal: OTHER_SITE };
  if (mediaOf(headers.get('content-type')).toLowerCase() !== JSON_MEDIA)
    return { status: UNSUPPORTED_MEDIA_TYPE, refusal: WRONG_MEDIA };
  return undefined;
};

/** The two tests every write door applies before it reads one byte of a body. */
export const admitOwnSiteJson = (): MiddlewareHandler => async (context, next) => {
  const held = turnedAway(context.req.raw.headers);
  if (held !== undefined) return context.json({ refusal: held.refusal }, held.status);
  await next();
  return undefined;
};
