// A server can send a compressed answer although the fetch asks for none. The Wayback Machine
// gives the original bytes of a capture at a dated raw address ("id_"), and these bytes can be
// gzip or brotli, with or without the Content-Encoding header. The text of the page is read, and
// the page is stored, only after the bytes are decoded.

import {
  brotliDecompressSync,
  gunzipSync,
  inflateRawSync,
  inflateSync,
  type ZlibOptions,
} from 'node:zlib';

import { ToolRefusal } from './tool.ts';

// External constraint: the first bytes of a gzip member (RFC 1952) and of a zlib stream
// (RFC 1950). Brotli (RFC 7932) has no signature.
const GZIP_SIGNATURE = [0x1f, 0x8b, 0x08] as const;

const opensWithGzip = (bytes: Uint8Array): boolean =>
  GZIP_SIGNATURE.every((byte, at) => bytes[at] === byte);

// The method nibble is 8 (deflate), the window is at most 32 KiB, and the two bytes as one number
// are a multiple of 31.
const opensWithZlib = (bytes: Uint8Array): boolean => {
  const [first, second] = [bytes[0], bytes[1]];
  if (first === undefined || second === undefined) return false;
  return (first & 0x0f) === 8 && first >> 4 <= 7 && ((first << 8) | second) % 31 === 0;
};

// A text in a charset of one byte, or in UTF-8, holds almost no control byte. A compressed or
// binary body holds about one byte in eight. UTF-16 holds a zero byte for each Latin letter, and
// it opens with a byte order mark.
const SAMPLE = 65_536;
const BINARY_SHARE = 0.05;

const opensWithUtf16Mark = (bytes: Uint8Array): boolean =>
  (bytes[0] === 0xfe && bytes[1] === 0xff) || (bytes[0] === 0xff && bytes[1] === 0xfe);

// A charset of two or four bytes for each Latin letter, named in the Content-Type.
const wideCharset = (contentType: string | null): boolean =>
  /;\s*charset\s*=\s*"?utf-?(?:16|32)/iu.test(contentType ?? '');

/**
 * True when the bytes are not text: a share of control bytes that no text holds. A body in UTF-16
 * or UTF-32 is text when a byte order mark or the charset of the Content-Type names it.
 */
export const binaryBytes = (bytes: Uint8Array, contentType: string | null = null): boolean => {
  if (bytes.length === 0 || opensWithUtf16Mark(bytes) || wideCharset(contentType)) return false;
  const sample = bytes.subarray(0, SAMPLE);
  let control = 0;
  for (const byte of sample)
    if (byte < 0x20 && byte !== 0x09 && byte !== 0x0a && byte !== 0x0c && byte !== 0x0d)
      control += 1;
  return control / sample.length > BINARY_SHARE;
};

/** True for a type that names text: a page of HTML, a text file, XML or JSON. */
export const textType = (mime: string): boolean =>
  mime.startsWith('text/') ||
  mime === 'application/xml' ||
  mime === 'application/json' ||
  mime.endsWith('+xml') ||
  mime.endsWith('+json');

/** The type that says nothing of the file: only "bytes". */
export const GENERIC = 'application/octet-stream';

/** The type of a Content-Type with no parameter, in lower case, or "" when it names none. */
export const declaredMime = (contentType: string | null): string =>
  (contentType?.split(';')[0] ?? '').trim().toLowerCase();

// A body is decoded on its first bytes only when its type names text or names nothing. A gzip
// file that the server names as gzip is that file, and it stays as it came.
const sniffable = (contentType: string | null): boolean => {
  const mime = declaredMime(contentType);
  return mime === '' || mime === GENERIC || textType(mime);
};

const tooLarge = (fault: unknown): boolean =>
  typeof fault === 'object' &&
  fault !== null &&
  'code' in fault &&
  fault.code === 'ERR_BUFFER_TOO_LARGE';

const decoded = (
  bytes: Uint8Array,
  name: string,
  decode: (input: Uint8Array, options: ZlibOptions) => Buffer,
  maxBytes: number,
): Uint8Array => {
  try {
    return new Uint8Array(decode(bytes, { maxOutputLength: maxBytes }));
  } catch (fault) {
    if (tooLarge(fault))
      throw new ToolRefusal(
        `the ${name} answer is larger than ${maxBytes} bytes when it is decoded, and it is refused`,
      );
    throw fault;
  }
};

// A deflate body is a zlib stream by the standard, but some servers send the raw stream.
const inflated = (input: Uint8Array, options: ZlibOptions): Buffer => {
  try {
    return inflateSync(input, options);
  } catch (fault) {
    if (tooLarge(fault)) throw fault;
    return inflateRawSync(input, options);
  }
};

const DECODERS: Readonly<Record<string, (input: Uint8Array, options: ZlibOptions) => Buffer>> = {
  gzip: gunzipSync,
  'x-gzip': gunzipSync,
  deflate: inflated,
  br: brotliDecompressSync,
};

// Bytes that do not decode are not that format: the first bytes matched by chance.
const attempt = (
  bytes: Uint8Array,
  name: string,
  decode: (input: Uint8Array, options: ZlibOptions) => Buffer,
  maxBytes: number,
): Uint8Array | null => {
  try {
    return decoded(bytes, name, decode, maxBytes);
  } catch (fault) {
    if (fault instanceof ToolRefusal) throw fault;
    return null;
  }
};

// A body can be compressed two times, for example a gzip capture that the archive sends as gzip.
const MAX_LAYERS = 3;

/**
 * The body as the page gives it: each encoding that the header names is decoded, last first, and
 * then each layer that the first bytes show. Brotli has no signature, so a body of a text type
 * whose bytes are not text is tried as brotli, and it is kept when the result is text.
 */
export const decodedBody = (
  bytes: Uint8Array,
  contentEncoding: string | null,
  contentType: string | null,
  maxBytes: number,
): Uint8Array => {
  let body = bytes;
  const names = (contentEncoding ?? '')
    .split(',')
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name !== '' && name !== 'identity')
    .reverse();
  for (const name of names) {
    const decode = DECODERS[name];
    if (decode === undefined)
      throw new ToolRefusal(
        `the server encoded the answer as "${name}", and this tool decodes only gzip, deflate ` +
          'and br, so nothing is stored',
      );
    try {
      body = decoded(body, name, decode, maxBytes);
    } catch (fault) {
      if (fault instanceof ToolRefusal) throw fault;
      throw new ToolRefusal(
        `the server named the encoding "${name}", but the answer does not decode as ${name}, so ` +
          'nothing is stored',
      );
    }
  }

  if (!sniffable(contentType)) return body;
  for (let layer = 0; layer < MAX_LAYERS; layer += 1) {
    let next: Uint8Array | null = null;
    if (opensWithGzip(body)) next = attempt(body, 'gzip', gunzipSync, maxBytes);
    else if (opensWithZlib(body) && binaryBytes(body, contentType))
      next = attempt(body, 'deflate', inflateSync, maxBytes);
    else if (binaryBytes(body, contentType)) {
      const text = attempt(body, 'br', brotliDecompressSync, maxBytes);
      next = text !== null && text.length > 0 && !binaryBytes(text, contentType) ? text : null;
    }
    if (next === null) return body;
    body = next;
  }
  return body;
};
