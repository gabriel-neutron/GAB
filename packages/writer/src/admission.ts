import { createHash, timingSafeEqual } from 'node:crypto';

import { OPERATOR_KEY_HEADER } from '@gab/proposal/request';
import type { MiddlewareHandler } from 'hono';
import { z } from 'zod';

const JSON_MEDIA = 'application/json';
const OWN_SITE = 'same-origin';

const WRONG_MEDIA = 'the body must be sent as application/json';
const OTHER_SITE = 'the request does not come from this site';
const NOT_OPERATOR =
  'the request does not carry the key of the operator; start pnpm dev, which opens the page with the key';

const UNSUPPORTED_MEDIA_TYPE = 415;
const FORBIDDEN = 403;

interface Turned {
  readonly status: typeof UNSUPPORTED_MEDIA_TYPE | typeof FORBIDDEN;
  readonly refusal: string;
}

// External constraint: the writer listens on 127.0.0.1:5177. The proxy of the development server
// sends the Host of the writer, and the browser sends the Origin of the page, which is on port
// 5173. No other name is this writer, and no other page is this site.
const OWN_HOSTS: ReadonlySet<string> = new Set(['127.0.0.1:5177', 'localhost:5177']);
const OWN_ORIGINS: ReadonlySet<string> = new Set(
  [...OWN_HOSTS, '127.0.0.1:5173', 'localhost:5173'].map((host) => `http://${host}`),
);

const mediaOf = (header: string | null): string => (header ?? '').split(';')[0]?.trim() ?? '';

const digest = (text: string): Buffer => createHash('sha256').update(text).digest();

// Hashing first gives two buffers of one length, which timingSafeEqual needs.
const fromOperator = (headers: Headers, key: string): boolean =>
  timingSafeEqual(digest(headers.get(OPERATOR_KEY_HEADER) ?? ''), digest(key));

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
// sends. A caller that is not a browser sends no site header, so it must send the key of the
// operator: no header that a browser sends proves that the caller is a browser.
const turnedAway = (headers: Headers, operatorKey: string): Turned | undefined => {
  if (fromOtherSite(headers)) return { status: FORBIDDEN, refusal: OTHER_SITE };
  if (!fromOperator(headers, operatorKey)) return { status: FORBIDDEN, refusal: NOT_OPERATOR };
  if (mediaOf(headers.get('content-type')).toLowerCase() !== JSON_MEDIA)
    return { status: UNSUPPORTED_MEDIA_TYPE, refusal: WRONG_MEDIA };
  return undefined;
};

const OPERATOR_KEY = z.string().regex(/^[A-Za-z0-9_-]{32,}$/u);

/** The key of the operator, from the environment. The writer does not start without it. The error
 * never holds the value. */
export const operatorKeyOf = (env: Record<string, string | undefined>): string => {
  const key = OPERATOR_KEY.safeParse(env['GABRIEL_OPERATOR_KEY']);
  if (key.success) return key.data;
  throw new Error(
    'GABRIEL_OPERATOR_KEY in infra/.env must hold at least 32 characters of A-Z, a-z, 0-9, - and _. ' +
      "Make a key with: node -e \"console.log(require('node:crypto').randomBytes(32).toString('base64url'))\"",
  );
};

export const admitOwnSiteJson =
  (operatorKey: string): MiddlewareHandler =>
  async (context, next) => {
    const held = turnedAway(context.req.raw.headers, operatorKey);
    if (held !== undefined) return context.json({ refusal: held.refusal }, held.status);
    await next();
    return undefined;
  };
